package middleware

import (
	"mime"
	"net/http"
	"strings"
)

// RequireJSONContentType rejects requests whose Content-Type is not application/json.
// Cross-site form submissions can only set Content-Type to application/x-www-form-urlencoded,
// multipart/form-data, or text/plain without triggering a CORS preflight, so enforcing
// application/json prevents login CSRF (see issue #525).
func RequireJSONContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || !strings.EqualFold(mediaType, "application/json") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnsupportedMediaType)
			w.Write([]byte(`{"message":"Content-Type must be application/json"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}
