package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var httpRequestsCount = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Name: "http_requests_count",
		Help: "Count of HTTP requests",
	},
	[]string{"type", "method", "code"},
)

func init() {
	prometheus.MustRegister(httpRequestsCount)
}

type RequestType string

const (
	RequestTypeProxy       RequestType = "proxy"
	RequestTypeAPIPublic   RequestType = "api-public"
	RequestTypeAPIInternal RequestType = "api-internal"
)

func TrackRequestMetrics(requestType RequestType, next http.Handler) http.Handler {
	return promhttp.InstrumentHandlerCounter(
		httpRequestsCount.MustCurryWith(prometheus.Labels{"type": string(requestType)}),
		next,
	)
}
