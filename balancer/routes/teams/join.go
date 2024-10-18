package teams

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"k8s.io/apimachinery/pkg/api/errors"
)

func HandleTeamJoin(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")

			_, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
			if err != nil && errors.IsNotFound(err) {

				// Create a deployment for the team

				err := createDeploymentForTeam(bundle, team, "very-hashy")
				if err != nil {
					http.Error(responseWriter, "failed to create deployment", http.StatusInternalServerError)
					return
				}
				err = createServiceForTeam(bundle, team)
				if err != nil {
					http.Error(responseWriter, "failed to create service", http.StatusInternalServerError)
					return
				}

				cookie, err := signutil.Sign(team, os.Getenv("COOKIEPARSER_SECRET"))
				if err != nil {
					http.Error(responseWriter, "failed to sign team cookie", http.StatusInternalServerError)
					return
				}

				responseBody, _ := json.Marshal(map[string]string{
					"message":  "Created Instance",
					"passcode": "12345678",
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
				"app.kubernetes.io/version":   bundle.Config.JuiceShopTag,
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
						"app.kubernetes.io/version": bundle.Config.JuiceShopTag,
						"app.kubernetes.io/name":    "juice-shop",
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "juice-shop",
							Image: fmt.Sprintf("%s:%s", bundle.Config.JuiceShopImage, bundle.Config.JuiceShopTag),
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: 3000,
								},
							},
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/rest/admin/application-version",
										Port: intstr.FromInt(3000),
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       2,
								FailureThreshold:    10,
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
						},
					},
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
				"app.kubernetes.io/version":   bundle.Config.JuiceShopTag,
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
