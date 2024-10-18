package routes

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

func handleStaticFiles(bundle *bundle.Bundle) http.Handler {
	return http.StripPrefix("/balancer", http.FileServer(http.Dir(bundle.StaticAssetsDirectory)))
}
