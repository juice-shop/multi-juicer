package routes

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var httpRequestsCount = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_count",
		Help: "Count of HTTP requests",
	},
	[]string{"method", "code"},
)

func init() {
	prometheus.MustRegister(httpRequestsCount)
}

func AddRoutes(
	router *http.ServeMux,
	bundle *bundle.Bundle,
) {
	router.Handle("/", trackRequestMetrics(handleProxy(bundle)))
	router.Handle("GET /balancer/", handleStaticFiles(bundle))
	router.Handle("POST /balancer/teams/{team}/join", handleTeamJoin(bundle))
	router.Handle("GET /balancer/teams/{team}/wait-till-ready", handleWaitTillReady(bundle))
	router.Handle("POST /balancer/teams/logout", handleLogout(bundle))
	router.Handle("POST /balancer/teams/reset-passcode", handleResetPasscode(bundle))
	router.Handle("GET /balancer/score-board/top", handleScoreBoard(bundle))
	router.Handle("GET /balancer/admin/all", handleAdminListInstances(bundle))

	router.HandleFunc("GET /balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}

func trackRequestMetrics(next http.Handler) http.Handler {
	return promhttp.InstrumentHandlerCounter(httpRequestsCount, next)
}
