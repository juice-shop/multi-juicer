package public

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/metrics"
)

func AddRoutes(
	router *http.ServeMux,
	bundle *bundle.Bundle,
) {
	api := func(h http.Handler) http.Handler {
		return metrics.TrackRequestMetrics(metrics.RequestTypeAPIPublic, h)
	}

	router.Handle("/", metrics.TrackRequestMetrics(metrics.RequestTypeProxy, handleProxy(bundle)))
	router.Handle("GET /balancer", api(redirectLoggedInTeamsToStatus(bundle, handleStaticFiles(bundle))))
	router.Handle("GET /balancer/", api(handleStaticFiles(bundle)))
	router.Handle("POST /balancer/api/teams/{team}/join", api(handleTeamJoin(bundle)))
	router.Handle("POST /balancer/api/teams/logout", api(handleLogout(bundle)))
	router.Handle("POST /balancer/api/teams/reset-passcode", api(handleResetPasscode(bundle)))
	router.Handle("GET /balancer/api/score-board/top", api(handleScoreBoard(bundle)))
	router.Handle("GET /balancer/api/challenges", api(handleChallenges(bundle)))
	router.Handle("GET /balancer/api/challenges/{challengeKey}", api(handleChallengeDetail(bundle)))
	router.Handle("GET /balancer/api/teams/status", api(handleTeamStatus(bundle)))
	router.Handle("GET /balancer/api/teams/{team}/status", api(handleTeamStatus(bundle)))
	router.Handle("GET /balancer/api/activity-feed", api(handleActivityFeed(bundle)))
	router.Handle("GET /balancer/api/notifications", api(handleNotifications(bundle)))

	router.Handle("GET /balancer/api/admin/all", api(requireAdmin(bundle, handleAdminListInstances(bundle))))
	router.Handle("DELETE /balancer/api/admin/teams/{team}/delete", api(requireAdmin(bundle, handleAdminDeleteInstance(bundle))))
	router.Handle("POST /balancer/api/admin/teams/{team}/restart", api(requireAdmin(bundle, handleAdminRestartInstance(bundle))))
	router.Handle("POST /balancer/api/admin/notifications", api(requireAdmin(bundle, handleAdminPostNotification(bundle))))
	router.Handle("POST /balancer/api/admin/clock", api(requireAdmin(bundle, handleAdminSetClock(bundle))))
	router.Handle("POST /balancer/api/admin/teams/{team}/reset-passcode", api(requireAdmin(bundle, handleAdminResetPasscode(bundle))))

	router.HandleFunc("GET /balancer/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /balancer/api/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}
