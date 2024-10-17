package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	signutil "github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

func sleep(duration time.Duration) {
	time.Sleep(duration)
}

func main() {
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	router := http.NewServeMux()

	// Serve static files from /public/ under the /balancer path
	staticDir := "/public/"
	fs := http.FileServer(http.Dir(staticDir))
	router.Handle("/balancer/", http.StripPrefix("/balancer", fs))

	router.HandleFunc("POST /balancer/teams/{team}/join", func(responseWriter http.ResponseWriter, req *http.Request) {
		team := req.PathValue("team")

		_, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		if err != nil && errors.IsNotFound(err) {

			// Create a deployment for the team
			config := NewConfig()

			err := createDeploymentForTeam(clientset, config, team, "very-hashy")
			if err != nil {
				http.Error(responseWriter, "failed to create deployment", http.StatusInternalServerError)
				return
			}
			err = createServiceForTeam(clientset, config, team)
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
	})

	router.HandleFunc("GET /balancer/teams/{team}/wait-till-ready", func(responseWriter http.ResponseWriter, req *http.Request) {
		team := req.PathValue("team")
		if team == "" {
			http.Error(responseWriter, "team parameter is missing", http.StatusBadRequest)
			return
		}

		log.Default().Printf("Awaiting readiness of JuiceShop Deployment for team '%s'", team)

		// Loop to check readiness with a 180-second timeout (180 iterations of 1 second sleep)
		for i := 0; i < 180; i++ {
			// Get deployment for the specific team
			deployment, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
			if err != nil {
				log.Default().Printf("Error fetching deployment for team '%s': %v", team, err)
				http.Error(responseWriter, "Error fetching deployment", http.StatusInternalServerError)
				return
			}

			// Check if deployment is ready
			if deployment.Status.ReadyReplicas == 1 {
				log.Default().Printf("JuiceShop Deployment for team '%s' is ready", team)
				responseWriter.WriteHeader(http.StatusOK)
				return
			}

			// Wait for 1 second before retrying
			sleep(1 * time.Second)
		}

		// If the loop finishes without the deployment becoming ready
		log.Default().Printf("Waiting for deployment of team '%s' timed out", team)
		http.Error(responseWriter, "Waiting for Deployment Readiness Timed Out", http.StatusInternalServerError)
	})

	router.HandleFunc("GET /balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	router.HandleFunc("GET /balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

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
