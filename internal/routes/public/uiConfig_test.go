package public

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUIConfigHandler(t *testing.T) {
	t.Run("returns which views are shown", func(t *testing.T) {
		bundle := testutil.NewTestBundle()
		bundle.Config.ShowScoreboardView = false
		bundle.Config.ShowCtfView = true

		server := http.NewServeMux()
		AddRoutes(server, bundle)

		req, _ := http.NewRequest("GET", "/multi-juicer/api/ui-config", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

		var response UIConfigResponse
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))
		assert.Equal(t, UIConfigResponse{ShowScoreboardView: false, ShowCtfView: true}, response)
	})
}
