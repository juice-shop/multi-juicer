package teamcookie

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/signutil"
)

func GetTeamFromRequest(bundle *bundle.Bundle, req *http.Request) (string, error) {
	teamCookie, err := req.Cookie(bundle.Config.CookieConfig.Name)
	if err != nil {
		return "", fmt.Errorf("request is missing team cookie")
	}
	cookieTeamname, err := signutil.Unsign(teamCookie.Value, bundle.Config.CookieConfig.SigningKey)
	if err != nil {
		return "", fmt.Errorf("cookie is signed by an invalid key")
	}

	return cookieTeamname, nil
}
