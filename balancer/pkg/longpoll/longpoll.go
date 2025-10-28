package longpoll

import (
	"context"
	"net/http"
	"time"
)

// FetchFunc is a function that fetches data, optionally waiting for updates
// newer than the provided timestamp. It returns:
// - data: The fetched data (can be nil if no updates)
// - lastUpdate: The timestamp of the last update
// - hasUpdate: Whether new data is available (false means timeout/no updates)
// - err: Any error that occurred during fetching
type FetchFunc[T any] func(ctx context.Context, waitAfter *time.Time) (data T, lastUpdate time.Time, hasUpdate bool, err error)

// HandleLongPoll handles the common long polling logic for HTTP endpoints.
// It:
// - Parses the "wait-for-update-after" query parameter
// - Calls the provided fetchFunc with the appropriate parameters
// - Returns 204 No Content if no updates are available
// - Returns 400 Bad Request if the timestamp is invalid
// - Returns the data if updates are available
//
// The fetchFunc should:
// - If waitAfter is nil, return current data immediately
// - If waitAfter is set, wait for updates newer than that timestamp (with context for timeout)
// - Return hasUpdate=false if the wait times out without new data
func HandleLongPoll[T any](
	req *http.Request,
	fetchFunc FetchFunc[T],
) (data T, lastUpdate time.Time, statusCode int, err error) {
	var waitAfter *time.Time
	var zero T

	// Check if this is a long polling request
	if waitParam := req.URL.Query().Get("wait-for-update-after"); waitParam != "" {
		parsedTime, parseErr := time.Parse(time.RFC3339, waitParam)
		if parseErr != nil {
			return zero, time.Time{}, http.StatusBadRequest, parseErr
		}
		waitAfter = &parsedTime
	}

	// Fetch data using the provided function
	data, lastUpdate, hasUpdate, fetchErr := fetchFunc(req.Context(), waitAfter)
	if fetchErr != nil {
		return zero, time.Time{}, http.StatusInternalServerError, fetchErr
	}

	// If waiting for updates but none are available, return 204 No Content
	if waitAfter != nil && !hasUpdate {
		return zero, time.Time{}, http.StatusNoContent, nil
	}

	return data, lastUpdate, http.StatusOK, nil
}
