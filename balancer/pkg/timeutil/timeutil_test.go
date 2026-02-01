package timeutil

import (
	"testing"
	"time"
)

func TestTruncateToMillisecond(t *testing.T) {
	// Test that nanoseconds are removed
	original := time.Date(2026, 2, 1, 18, 32, 48, 123456789, time.UTC)
	truncated := TruncateToMillisecond(original)
	expected := time.Date(2026, 2, 1, 18, 32, 48, 123000000, time.UTC)

	if !truncated.Equal(expected) {
		t.Errorf("Expected %v, got %v", expected, truncated)
	}
}

func TestRoundTripThroughRFC3339(t *testing.T) {
	// Simulate the full cycle: backend -> frontend -> backend
	serverTime := TruncateToMillisecond(time.Now())

	// Frontend parses and sends back (JavaScript Date.toISOString() includes milliseconds)
	formatted := serverTime.Format(time.RFC3339Nano)
	parsed, err := time.Parse(time.RFC3339Nano, formatted)
	if err != nil {
		t.Fatalf("Failed to parse time: %v", err)
	}

	// Should be equal after round trip
	if !serverTime.Equal(parsed) {
		t.Errorf("Round trip failed: %v != %v", serverTime, parsed)
	}
}

func TestComparisonAfterTruncation(t *testing.T) {
	// Two times that differ only in nanoseconds
	t1 := time.Date(2026, 2, 1, 18, 32, 48, 123456789, time.UTC)
	t2 := time.Date(2026, 2, 1, 18, 32, 48, 123999999, time.UTC)

	// After truncation, they should be equal
	truncated1 := TruncateToMillisecond(t1)
	truncated2 := TruncateToMillisecond(t2)

	if !truncated1.Equal(truncated2) {
		t.Errorf("Expected equal after truncation: %v != %v", truncated1, truncated2)
	}

	// .After() should return false
	if truncated1.After(truncated2) {
		t.Error("Expected .After() to return false for equal times")
	}
}
