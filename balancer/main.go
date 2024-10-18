package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	signutil "github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var namespace = os.Getenv("NAMESPACE")

// newReverseProxy creates a reverse proxy for a given target URL.
func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL: %v", err)
	}

	return httputil.NewSingleHostReverseProxy(url)
}

// proxyHandler determines the target based on the "balancer" header and proxies the request.
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	cookieSecret := os.Getenv("COOKIEPARSER_SECRET")
	if cookieSecret == "" {
		http.Error(w, "", http.StatusInternalServerError)
		log.Default().Fatalf("COOKIEPARSER_SECRET environment variable must be set")
		return
	}

	teamSigned, err := r.Cookie("balancer")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read balancer cookie: %v", err), http.StatusBadRequest)
		return
	}
	team, err := signutil.Unsign(teamSigned.Value, cookieSecret)
	if err != nil {
		http.Error(w, "Team cookie invalid!", http.StatusUnauthorized)
		return
	}

	var target string

	if team == "" {
		http.Error(w, fmt.Sprintf("Empty team for balancer cookie: '%s',", teamSigned), http.StatusBadRequest)
		return
	} else {
		target = fmt.Sprintf("http://juiceshop-%s.%s.svc.cluster.local:3000", team, namespace)
	}

	log.Default().Printf("proxing request for team (%s): %s %s to %s", team, r.Method, r.URL, target)

	proxy := newReverseProxy(target)
	// Rewrite the request to the target server
	proxy.ServeHTTP(w, r)
}

func main() {
	router := http.NewServeMux()

	// Serve static files from /public/ under the /balancer path
	staticDir := "/public/"
	fs := http.FileServer(http.Dir(staticDir))
	router.Handle("/balancer/", http.StripPrefix("/balancer", fs))

	addRoutes(router, createBundle())

	// Start an HTTP server with our proxy handler
	router.HandleFunc("/", proxyHandler)
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

	return &bundle.Bundle{
		ClientSet: clientset,
		RuntimeEnvironment: bundle.RuntimeEnvironment{
			Namespace: namespace,
		},
		Config: &bundle.Config{
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
		},
	}
}
