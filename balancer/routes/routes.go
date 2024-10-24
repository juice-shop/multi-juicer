package routes

import (
	"fmt"
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
	[]string{"status_code"},
)

func init() {
	prometheus.MustRegister(httpRequestsCount)
}

func AddRoutes(
	router *http.ServeMux,
	bundle *bundle.Bundle,
) {
	router.Handle("GET /balancer/", handleStaticFiles(bundle))
	router.Handle("GET /balancer/metrics", promhttp.Handler())
	router.Handle("POST /balancer/teams/{team}/join", handleTeamJoin(bundle))
	router.Handle("GET /balancer/teams/{team}/wait-till-ready", handleWaitTillReady(bundle))
	router.Handle("POST /balancer/teams/logout", handleLogout(bundle))
	router.Handle("POST /balancer/teams/reset-passcode", handleResetPasscode(bundle))

	router.HandleFunc("GET /balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	router.Handle("/", requestCounterMiddleware(handleProxy(bundle)))
}

func requestCounterMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(&rec, r)
		httpRequestsCount.WithLabelValues(fmt.Sprintf("%dxx", rec.statusCode%100)).Inc()
	})
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rec *statusRecorder) WriteHeader(code int) {
	rec.statusCode = code
	rec.ResponseWriter.WriteHeader(code)
}
