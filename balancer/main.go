package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	signutil "github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

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
		target = fmt.Sprintf("http://t-%s-juiceshop.default.svc.cluster.local:3000", team)
	}

	log.Default().Printf("proxing request for team (%s): %s %s to %s", team, r.Method, r.URL, target)

	proxy := newReverseProxy(target)
	// Rewrite the request to the target server
	proxy.ServeHTTP(w, r)
}

func main() {
	http.HandleFunc("/balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	http.HandleFunc("/balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	// Start an HTTP server with our proxy handler
	http.HandleFunc("/", proxyHandler)
	log.Println("Starting proxy server on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
