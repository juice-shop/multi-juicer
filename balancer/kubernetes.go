package main

import (
	"context"
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
)

type Config struct {
	Namespace                         string
	JuiceShopImage                    string
	JuiceShopTag                      string
	JuiceShopNodeEnv                  string
	JuiceShopCtfKey                   string
	JuiceShopImagePullPolicy          string
	JuiceShopResources                map[string]string // Could be customized based on actual use
	JuiceShopPodSecurityContext       map[string]string // Could be customized based on actual use
	JuiceShopContainerSecurityContext map[string]string // Could be customized based on actual use
	JuiceShopEnvFrom                  []string
	JuiceShopVolumeMounts             []string
	JuiceShopVolumes                  []string
	JuiceShopTolerations              []string
	JuiceShopAffinity                 string
	DeploymentContext                 string
}

func NewConfig() *Config {
	return &Config{
		Namespace:                         "default", // Example value, replace with actual
		JuiceShopImage:                    "bkimminich/juice-shop",
		JuiceShopTag:                      "latest",
		JuiceShopNodeEnv:                  "production",
		JuiceShopCtfKey:                   "your-ctf-key",
		JuiceShopImagePullPolicy:          "IfNotPresent",
		JuiceShopResources:                make(map[string]string),
		JuiceShopPodSecurityContext:       make(map[string]string),
		JuiceShopContainerSecurityContext: make(map[string]string),
		JuiceShopEnvFrom:                  []string{},
		JuiceShopVolumeMounts:             []string{},
		JuiceShopVolumes:                  []string{},
		JuiceShopTolerations:              []string{},
		JuiceShopAffinity:                 "",
		DeploymentContext:                 "default-context",
	}
}

func createDeploymentForTeam(clientset *kubernetes.Clientset, config *Config, team string, passcodeHash string) error {
	deployment := &appsv1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name: fmt.Sprintf("juiceshop-%s", team),
			Labels: map[string]string{
				"team":                         team,
				"app.kubernetes.io/version":    config.JuiceShopTag,
				"app.kubernetes.io/component":  "vulnerable-app",
				"app.kubernetes.io/managed-by": config.DeploymentContext,
				"app.kubernetes.io/name":       "juice-shop",
				"app.kubernetes.io/instance":   fmt.Sprintf("juice-shop-%s", config.DeploymentContext),
				"app.kubernetes.io/part-of":    "multi-juicer",
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
					"team":                         team,
					"app.kubernetes.io/name":       "juice-shop",
					"app.kubernetes.io/managed-by": config.DeploymentContext,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						"team":                         team,
						"app.kubernetes.io/version":    config.JuiceShopTag,
						"app.kubernetes.io/name":       "juice-shop",
						"app.kubernetes.io/managed-by": config.DeploymentContext,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "juice-shop",
							Image: fmt.Sprintf("%s:%s", config.JuiceShopImage, config.JuiceShopTag),
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

	_, err := clientset.AppsV1().Deployments(config.Namespace).Create(context.TODO(), deployment, v1.CreateOptions{})
	return err
}

func createServiceForTeam(clientset *kubernetes.Clientset, config *Config, team string) error {
	service := &corev1.Service{
		ObjectMeta: v1.ObjectMeta{
			Name: fmt.Sprintf("juiceshop-%s", team),
			Labels: map[string]string{
				"team":                         team,
				"app.kubernetes.io/version":    config.JuiceShopTag,
				"app.kubernetes.io/name":       "juice-shop",
				"app.kubernetes.io/managed-by": config.DeploymentContext,
				"app.kubernetes.io/component":  "vulnerable-app",
				"app.kubernetes.io/instance":   fmt.Sprintf("juice-shop-%s", config.DeploymentContext),
				"app.kubernetes.io/part-of":    "multi-juicer",
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				"team":                         team,
				"app.kubernetes.io/name":       "juice-shop",
				"app.kubernetes.io/managed-by": config.DeploymentContext,
			},
			Ports: []corev1.ServicePort{
				{
					Port: 3000,
				},
			},
		},
	}

	_, err := clientset.CoreV1().Services(config.Namespace).Create(context.TODO(), service, v1.CreateOptions{})
	return err
}
