package main

import (
	"log"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/routes"
)

func main() {
	bundle := bundle.New()

	router := http.NewServeMux()
	routes.AddRoutes(router, bundle)

	bundle.Log.Println("Starting MultiJuicer balancer on :8080")
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
