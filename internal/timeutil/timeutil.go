package timeutil

import "time"

// TruncateToMillisecond truncates a time.Time to millisecond precision,
// matching the precision of JavaScript Date objects to prevent long polling
// issues caused by nanosecond differences.
func TruncateToMillisecond(t time.Time) time.Time {
	return t.Truncate(time.Millisecond)
}
