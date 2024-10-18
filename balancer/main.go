package main

import (
	"errors"
	"log"
	"net/http"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var namespace = os.Getenv("NAMESPACE")

func main() {
	router := http.NewServeMux()

	// Serve static files from /public/ under the /balancer path
	staticDir := "/public/"
	fs := http.FileServer(http.Dir(staticDir))
	router.Handle("/balancer/", http.StripPrefix("/balancer", fs))

	addRoutes(router, createBundle())

	log.Println("Starting proxy server on :8080")
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func createBundle() *bundle.Bundle {
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	namespace := os.Getenv("NAMESPACE")
	if namespace == "" {
		panic(errors.New("'NAMESPACE' environment variable must be set!"))
	}

	cookieSigningKey := os.Getenv("MULTI_JUICER_CONFIG_COOKIE_SIGNING_KEY")
	if cookieSigningKey == "" {
		panic(errors.New("'MULTI_JUICER_CONFIG_COOKIE_SIGNING_KEY' environment variable must be set!"))
	}

	return &bundle.Bundle{
		ClientSet: clientset,
		RuntimeEnvironment: bundle.RuntimeEnvironment{
			Namespace: namespace,
		},
		Log: log.New(os.Stdout, "", log.LstdFlags),
		Config: &bundle.Config{
			JuiceShopConfig: bundle.JuiceShopConfig{
				ImagePullPolicy: "IfNotPresent",
				Image:           "bkimminich/juice-shop",
				Tag:             "latest",
				NodeEnv:         "multi-juicer",
				Resources: corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse("200m"),
						corev1.ResourceMemory: resource.MustParse("256Mi"),
					},
					Limits: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse("200m"),
						corev1.ResourceMemory: resource.MustParse("256Mi"),
					},
				},
			},
			CookieConfig: bundle.CookieConfig{
				SigningKey: cookieSigningKey,
			},
		},
	}
}
