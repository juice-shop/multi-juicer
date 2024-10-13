package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
)

// newReverseProxy creates a reverse proxy for a given target URL.
func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL: %v", err)
	}

	return httputil.NewSingleHostReverseProxy(url)
}

// proxyHandler determines the target based on the "X-Team" header and proxies the request.
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	team, err := r.Cookie("x-team")
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read X-Team cookie: %v", err), http.StatusBadRequest)
	}
	var target string

	if team.Value == "" {
		http.Error(w, fmt.Sprintf("Unknown X-Team cookie value: '%s'", team.Value), http.StatusBadRequest)
		return
	} else {
		target = fmt.Sprintf("http://t-%s-juiceshop.default.svc.cluster.local:3000", team.Value)
	}

	log.Default().Printf("proxing request: %s %s to %s", r.Method, r.URL, target)

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
