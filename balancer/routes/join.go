package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"golang.org/x/crypto/bcrypt"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/errors"
)

var loginCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "multijuicer_logins",
		Help: `Number of logins (including registrations, see label "userType").`,
	},
	[]string{"type", "userType"},
)
var failedLoginCounter = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "multijuicer_failed_logins",
		Help: `Number of failed logins, bad password (including admin logins, see label "userType").`,
	},
	[]string{"userType"},
)

func init() {
	prometheus.MustRegister(loginCounter)
	prometheus.MustRegister(failedLoginCounter)
}

func handleTeamJoin(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		team := r.PathValue("team")
		deployment, err := getDeployment(bundle, team)
		if err != nil && errors.IsNotFound(err) {
			createANewTeam(bundle, team, w)
		} else if err == nil {
			joinExistingTeam(bundle, team, deployment, w, r)
		} else {
			http.Error(w, "failed to get deployment", http.StatusInternalServerError)
		}
	})
}

func getDeployment(bundle *bundle.Bundle, team string) (*appsv1.Deployment, error) {
	return bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(
		context.Background(),
		fmt.Sprintf("juiceshop-%s", team),
		metav1.GetOptions{},
	)
}

var validTeamnamePattern = regexp.MustCompile("^[a-z]{1,16}$")

func isValidTeamName(s string) bool {
	matched := validTeamnamePattern.MatchString(s)
	return matched
}
func createANewTeam(bundle *bundle.Bundle, team string, w http.ResponseWriter) {
	if !isValidTeamName(team) {
		http.Error(w, "invalid team name", http.StatusBadRequest)
		return
	}

	passcode, passcodeHash, err := generatePasscode(bundle)
	if err != nil {
		bundle.Log.Printf("Failed to hash passcode!: %s", err)
		http.Error(w, "failed to generate passcode", http.StatusInternalServerError)
		return
	}

	err = createDeploymentForTeam(bundle, team, passcodeHash)
	if err != nil {
		bundle.Log.Printf("Failed to create deployment: %s", err)
		http.Error(w, "failed to create deployment", http.StatusInternalServerError)
		return
	}

	err = createServiceForTeam(bundle, team)
	if err != nil {
		bundle.Log.Printf("Failed to create service: %s", err)
		http.Error(w, "failed to create service", http.StatusInternalServerError)
		return
	}

	err = setSignedTeamCookie(bundle, team, w)
	if err != nil {
		http.Error(w, "failed to sign team cookie", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Created Instance", passcode)
	loginCounter.WithLabelValues("registration", "user").Inc()
}

func generatePasscode(bundle *bundle.Bundle) (string, string, error) {
	passcode := bundle.GeneratePasscode()
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(passcode), bundle.BcryptRounds)
	if err != nil {
		return "", "", err
	}
	return passcode, string(hashBytes), nil
}

func setSignedTeamCookie(bundle *bundle.Bundle, team string, w http.ResponseWriter) error {
	cookieValue, err := signutil.Sign(team, bundle.Config.CookieConfig.SigningKey)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     bundle.Config.CookieConfig.Name,
		Value:    cookieValue,
		HttpOnly: true,
		Path:     "/",
		SameSite: http.SameSiteStrictMode,
	})
	return nil
}

func sendSuccessResponse(w http.ResponseWriter, message, passcode string) {
	responseBody, _ := json.Marshal(map[string]string{
		"message":  message,
		"passcode": passcode,
	})
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(responseBody)
}

type joinRequestBody struct {
	Passcode string `json:"passcode"`
}

func joinExistingTeam(bundle *bundle.Bundle, team string, deployment *appsv1.Deployment, w http.ResponseWriter, r *http.Request) {
	passCodeHashToMatch := deployment.Annotations["multi-juicer.owasp-juice.shop/passcode"]
	if passCodeHashToMatch == "" {
		http.Error(w, "failed to get passcode", http.StatusInternalServerError)
		return
	}
	if r.Body == nil {
		// this not a failed login, but just a failed "team creation" for a already existing team, so we don't increment the counter
		writeUnauthorizedResponse(w)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil || len(body) == 0 {
		failedLoginCounter.WithLabelValues("user").Inc()
		writeUnauthorizedResponse(w)
		return
	}

	var requestBody joinRequestBody
	if err := json.Unmarshal(body, &requestBody); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	passcode := requestBody.Passcode
	if bcrypt.CompareHashAndPassword([]byte(passCodeHashToMatch), []byte(passcode)) != nil {
		failedLoginCounter.WithLabelValues("user").Inc()
		writeUnauthorizedResponse(w)
		return
	}

	err = setSignedTeamCookie(bundle, team, w)
	if err != nil {
		http.Error(w, "failed to sign team cookie", http.StatusInternalServerError)
		return
	}

	sendJoinedResponse(w)
}

func sendJoinedResponse(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Joined Team"}`))
}

// Helper function to write a 401 Unauthorized response
func writeUnauthorizedResponse(responseWriter http.ResponseWriter) {
	errorResponseBody, _ := json.Marshal(map[string]string{"message": "Team requires authentication to join"})
	responseWriter.WriteHeader(http.StatusUnauthorized)
	responseWriter.Header().Set("Content-Type", "application/json")
	responseWriter.Write(errorResponseBody)
}

// uid of the balancer kubernetes deployment resource. used to "attach" created juice shop deployments and services to the balancer deployment so that they get deleted when the balancer gets deleted
var deploymentUid types.UID

func getOwnerReferences(bundle *bundle.Bundle) ([]metav1.OwnerReference, error) {
	if deploymentUid == "" {
		balancerDeployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(
			context.Background(),
			"balancer",
			metav1.GetOptions{},
		)
		deploymentUid = balancerDeployment.ObjectMeta.UID
		if err != nil {
			return nil, fmt.Errorf("failed to get balancer deployment to attach correct owner reference to start juice shop: %w", err)
		}
	}

	truePointer := true
	ownerReferences := []metav1.OwnerReference{
		{
			APIVersion:         "apps/v1",
			Kind:               "Deployment",
			Name:               "balancer",
			UID:                deploymentUid,
			Controller:         &truePointer,
			BlockOwnerDeletion: &truePointer,
		},
	}
	return ownerReferences, nil
}

func createDeploymentForTeam(bundle *bundle.Bundle, team string, passcodeHash string) error {
	ownerReferences, err := getOwnerReferences(bundle)
	if err != nil {
		return err
	}
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("juiceshop-%s", team),
			Labels: map[string]string{
				"team":                        team,
				"app.kubernetes.io/version":   bundle.Config.JuiceShopConfig.Tag,
				"app.kubernetes.io/component": "vulnerable-app",
				"app.kubernetes.io/name":      "juice-shop",
				"app.kubernetes.io/instance":  fmt.Sprintf("juice-shop-%s", team),
				"app.kubernetes.io/part-of":   "multi-juicer",
			},
			Annotations: map[string]string{
				"multi-juicer.owasp-juice.shop/lastRequest":         fmt.Sprintf("%d", time.Now().UnixMilli()),
				"multi-juicer.owasp-juice.shop/lastRequestReadable": time.Now().String(),
				"multi-juicer.owasp-juice.shop/passcode":            passcodeHash,
				"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
				"multi-juicer.owasp-juice.shop/challenges":          "[]",
			},
			OwnerReferences: ownerReferences,
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"team":                   team,
					"app.kubernetes.io/name": "juice-shop",
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"team":                      team,
						"app.kubernetes.io/version": bundle.Config.JuiceShopConfig.Tag,
						"app.kubernetes.io/name":    "juice-shop",
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:            "juice-shop",
							Image:           fmt.Sprintf("%s:%s", bundle.Config.JuiceShopConfig.Image, bundle.Config.JuiceShopConfig.Tag),
							SecurityContext: &bundle.Config.JuiceShopConfig.ContainerSecurityContext,
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: 3000,
								},
							},
							StartupProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/rest/admin/application-version",
										Port: intstr.FromInt(3000),
									},
								},
								PeriodSeconds:    2,
								FailureThreshold: 150,
							},
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/rest/admin/application-version",
										Port: intstr.FromInt(3000),
									},
								},
								PeriodSeconds:    5,
								FailureThreshold: 3,
							},
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/rest/admin/application-version",
										Port: intstr.FromInt(3000),
									},
								},
								InitialDelaySeconds: 30,
								PeriodSeconds:       15,
							},
							Env: append(
								bundle.Config.JuiceShopConfig.Env,
								corev1.EnvVar{
									Name:  "NODE_ENV",
									Value: bundle.Config.JuiceShopConfig.NodeEnv,
								},
								corev1.EnvVar{
									Name:  "CTF_KEY",
									Value: bundle.Config.JuiceShopConfig.CtfKey,
								},
								corev1.EnvVar{
									Name:  "SOLUTIONS_WEBHOOK",
									Value: fmt.Sprintf("http://progress-watchdog.%s.svc/team/%s/webhook", bundle.RuntimeEnvironment.Namespace, team),
								},
							),
							EnvFrom: bundle.Config.JuiceShopConfig.EnvFrom,
							VolumeMounts: append(
								bundle.Config.JuiceShopConfig.VolumeMounts,
								corev1.VolumeMount{
									Name:      "juice-shop-config",
									MountPath: "/juice-shop/config/multi-juicer.yaml",
									ReadOnly:  true,
									SubPath:   "multi-juicer.yaml",
								},
							),
						},
					},
					Volumes: append(
						bundle.Config.JuiceShopConfig.Volumes,
						corev1.Volume{
							Name: "juice-shop-config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: "juice-shop-config",
									},
								},
							},
						},
					),
					Tolerations:      bundle.Config.JuiceShopConfig.Tolerations,
					Affinity:         &bundle.Config.JuiceShopConfig.Affinity,
					RuntimeClassName: bundle.Config.JuiceShopConfig.RuntimeClassName,
					SecurityContext:  &bundle.Config.JuiceShopConfig.PodSecurityContext,
				},
			},
		},
	}

	_, err = bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Create(context.Background(), deployment, metav1.CreateOptions{})
	return err
}

func createServiceForTeam(bundle *bundle.Bundle, team string) error {
	ownerReferences, err := getOwnerReferences(bundle)
	if err != nil {
		return err
	}

	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("juiceshop-%s", team),
			Labels: map[string]string{
				"team":                        team,
				"app.kubernetes.io/version":   bundle.Config.JuiceShopConfig.Tag,
				"app.kubernetes.io/name":      "juice-shop",
				"app.kubernetes.io/component": "vulnerable-app",
				"app.kubernetes.io/instance":  fmt.Sprintf("juice-shop-%s", team),
				"app.kubernetes.io/part-of":   "multi-juicer",
			},
			OwnerReferences: ownerReferences,
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				"team":                   team,
				"app.kubernetes.io/name": "juice-shop",
			},
			Ports: []corev1.ServicePort{
				{
					Port: 3000,
				},
			},
		},
	}

	_, err = bundle.ClientSet.CoreV1().Services(bundle.RuntimeEnvironment.Namespace).Create(context.Background(), service, metav1.CreateOptions{})
	return err
}
