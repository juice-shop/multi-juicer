package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
)

// Test for the HelloHandler
func TestStaticFileHandler(t *testing.T) {
	req, _ := http.NewRequest("GET", "/balancer/", nil)
	rr := httptest.NewRecorder()

	server := http.NewServeMux()
	bundle := testutil.NewTestBundle()
	bundle.StaticAssetsDirectory = "../ui/build/"
	AddRoutes(server, bundle)

	server.ServeHTTP(rr, req)

	assert.Equal(t, rr.Code, http.StatusOK)
	assert.Equal(t, rr.Header().Get("Content-Type"), "text/html; charset=utf-8")
	assert.Contains(t, rr.Body.String(), "<title>MultiJuicer</title>")
}
