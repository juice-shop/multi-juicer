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
	router.Handle("GET /multi-juicer", api(redirectLoggedInTeamsToStatus(bundle, handleStaticFiles(bundle))))
	router.Handle("GET /multi-juicer/", api(handleStaticFiles(bundle)))
	router.Handle("POST /multi-juicer/api/teams/{team}/join", api(handleTeamJoin(bundle)))
	router.Handle("POST /multi-juicer/api/teams/logout", api(handleLogout(bundle)))
	router.Handle("POST /multi-juicer/api/teams/reset-passcode", api(handleResetPasscode(bundle)))
	router.Handle("GET /multi-juicer/api/score-board/top", api(handleScoreBoard(bundle)))
	router.Handle("GET /multi-juicer/api/challenges", api(handleChallenges(bundle)))
	router.Handle("GET /multi-juicer/api/challenges/{challengeKey}", api(requireAdmin(bundle, handleChallengeDetail(bundle))))
	router.Handle("GET /multi-juicer/api/teams/status", api(handleTeamStatus(bundle)))
	router.Handle("GET /multi-juicer/api/teams/{team}/status", api(handleTeamStatus(bundle)))
	router.Handle("GET /multi-juicer/api/activity-feed", api(handleActivityFeed(bundle)))
	router.Handle("GET /multi-juicer/api/notifications", api(handleNotifications(bundle)))

	router.Handle("GET /multi-juicer/api/admin/all", api(requireAdmin(bundle, handleAdminListInstances(bundle))))
	router.Handle("DELETE /multi-juicer/api/admin/teams/{team}/delete", api(requireAdmin(bundle, handleAdminDeleteInstance(bundle))))
	router.Handle("POST /multi-juicer/api/admin/teams/{team}/restart", api(requireAdmin(bundle, handleAdminRestartInstance(bundle))))
	router.Handle("POST /multi-juicer/api/admin/notifications", api(requireAdmin(bundle, handleAdminPostNotification(bundle))))
	router.Handle("POST /multi-juicer/api/admin/clock", api(requireAdmin(bundle, handleAdminSetClock(bundle))))
	router.Handle("POST /multi-juicer/api/admin/teams/{team}/reset-passcode", api(requireAdmin(bundle, handleAdminResetPasscode(bundle))))

	router.HandleFunc("GET /multi-juicer/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /multi-juicer/api/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
}
