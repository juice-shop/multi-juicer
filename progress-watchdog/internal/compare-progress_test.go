package internal

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCompareChallengeStates(t *testing.T) {
	// NoOp Code cases
	assert.Equal(t, NoOp, CompareChallengeStates(
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}, {Key: "ghostLoginChallenge", SolvedAt: "foobar"}},
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}, {Key: "ghostLoginChallenge", SolvedAt: "foobar"}},
	),
		"Should not apply when both are equal",
	)
	assert.Equal(t, NoOp, CompareChallengeStates(
		[]ChallengeStatus{},
		[]ChallengeStatus{},
	),
		"Should not apply when both are empty",
	)

	// UpdateCache Code cases
	assert.Equal(t, UpdateCache, CompareChallengeStates(
		[]ChallengeStatus{{Key: "ghostLoginChallenge", SolvedAt: "foobar"}, {Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}},
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}},
	),
		"Should not apply when current one is larger",
	)
	assert.Equal(t, UpdateCache, CompareChallengeStates(
		[]ChallengeStatus{{Key: "ghostLoginChallenge", SolvedAt: "foobar"}, {Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}},
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}, {Key: "ghostLoginChallenge", SolvedAt: "foobar"}},
	),
		"Should not apply when both are equal, even when the ordering is different",
	)

	// Apply Code cases
	assert.Equal(t, ApplyCode, CompareChallengeStates(
		[]ChallengeStatus{},
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}},
	),
		"Should apply when a challenge is not contained",
	)
	assert.Equal(t, ApplyCode, CompareChallengeStates(
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}},
		[]ChallengeStatus{{Key: "httpHeaderXssChallenge", SolvedAt: "foobar"}, {Key: "ghostLoginChallenge", SolvedAt: "foobar"}},
	),
		"Should apply when a challenge is not contained",
	)
}
