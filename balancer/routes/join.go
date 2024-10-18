package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"k8s.io/apimachinery/pkg/api/errors"
)

func handleTeamJoin(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")

			_, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
			if err != nil && errors.IsNotFound(err) {

				passcode := bundle.PasscodeGenerator()

				// Generate a bcrypt hash of the password
				passcodeHashBytes, err := bcrypt.GenerateFromPassword([]byte(passcode), bundle.BcryptRounds)
				if err != nil {
					bundle.Log.Printf("Failed to hash passcode!: %s", err)
					http.Error(responseWriter, "", http.StatusInternalServerError)
					return
				}
				passcodeHash := string(passcodeHashBytes)

				// Create a deployment for the team
				err = createDeploymentForTeam(bundle, team, passcodeHash)
				if err != nil {
					bundle.Log.Printf("Failed to create deployment: %s", err)

					http.Error(responseWriter, "failed to create deployment", http.StatusInternalServerError)
					return
				}
				err = createServiceForTeam(bundle, team)
				if err != nil {
					bundle.Log.Printf("Failed to create service: %s", err)
					http.Error(responseWriter, "failed to create service", http.StatusInternalServerError)
					return
				}

				cookie, err := signutil.Sign(team, bundle.Config.CookieConfig.SigningKey)
				if err != nil {
					http.Error(responseWriter, "failed to sign team cookie", http.StatusInternalServerError)
					return
				}

				responseBody, _ := json.Marshal(map[string]string{
					"message":  "Created Instance",
					"passcode": passcode,
				})

				http.SetCookie(responseWriter, &http.Cookie{
					Name:     "balancer",
					Value:    cookie,
					HttpOnly: true,
					Path:     "/",
					SameSite: http.SameSiteStrictMode,
				})
				responseWriter.Header().Set("Content-Type", "application/json")
				responseWriter.WriteHeader(http.StatusOK)
				responseWriter.Write(responseBody)
			} else if err != nil && !errors.IsNotFound(err) {
				http.Error(responseWriter, "failed to get deployment", http.StatusInternalServerError)
				return
			} else {
				errorResponseBody, _ := json.Marshal(map[string]string{"message": "Team requires authentication to join"})
				responseWriter.WriteHeader(http.StatusUnauthorized)
				responseWriter.Header().Set("Content-Type", "application/json")
				responseWriter.Write(errorResponseBody)
				return
			}
		},
	)
}

func createDeploymentForTeam(bundle *bundle.Bundle, team string, passcodeHash string) error {
	deployment := &appsv1.Deployment{
		ObjectMeta: v1.ObjectMeta{
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
				"multi-juicer.owasp-juice.shop/lastRequest":         fmt.Sprintf("%d", time.Now().Unix()),
				"multi-juicer.owasp-juice.shop/lastRequestReadable": time.Now().String(),
				"multi-juicer.owasp-juice.shop/passcode":            passcodeHash,
				"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
				"multi-juicer.owasp-juice.shop/challenges":          "[]",
			},
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &v1.LabelSelector{
				MatchLabels: map[string]string{
					"team":                   team,
					"app.kubernetes.io/name": "juice-shop",
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
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

	_, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Create(context.TODO(), deployment, v1.CreateOptions{})
	return err
}

func createServiceForTeam(bundle *bundle.Bundle, team string) error {
	service := &corev1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name: fmt.Sprintf("juiceshop-%s", team),
			Labels: map[string]string{
				"team":                        team,
				"app.kubernetes.io/version":   bundle.Config.JuiceShopConfig.Tag,
				"app.kubernetes.io/name":      "juice-shop",
				"app.kubernetes.io/component": "vulnerable-app",
				"app.kubernetes.io/instance":  fmt.Sprintf("juice-shop-%s", team),
				"app.kubernetes.io/part-of":   "multi-juicer",
			},
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

	_, err := bundle.ClientSet.CoreV1().Services(bundle.RuntimeEnvironment.Namespace).Create(context.TODO(), service, v1.CreateOptions{})
	return err
}
