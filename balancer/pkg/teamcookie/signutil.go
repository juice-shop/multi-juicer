package teamcookie

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

func GetTeamFromRequest(bundle *bundle.Bundle, req *http.Request) (string, error) {
	balancerCookie, err := req.Cookie(bundle.Config.CookieConfig.Name)
	if err != nil {
		return "", fmt.Errorf("request is missing team cookie")
	}
	cookieTeamname, err := signutil.Unsign(balancerCookie.Value, bundle.Config.CookieConfig.SigningKey)
	if err != nil {
		return "", fmt.Errorf("cookie is signed by an invalid key")
	}

	return cookieTeamname, nil
}
