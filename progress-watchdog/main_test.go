package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParsesContinueCodes(t *testing.T) {
	passedChallenges, err := ParseContinueCode("LRo3lzE7XYnWkwaZNdE7i3Hku6TqCQiW8i5NF96H2b0yPxve5Mq4pK18VJmg")
	assert.NoError(t, err, "Parsing continueCode returned unexpected error")
	assert.Equal(t, passedChallenges, []int{11, 15, 16, 21, 36, 39, 53, 70, 80, 83}, "ContinueCode solved a different set of challenges than expected")
}

func TestParsesEmptyStringIntoEmptyArray(t *testing.T) {
	passedChallenges, err := ParseContinueCode("")
	assert.NoError(t, err, "Parsing continueCode returned unexpected error")
	assert.Equal(t, passedChallenges, []int{})
}

func TestReturnsErrorOnInvalidCodes(t *testing.T) {
	// Contains chars not in the alphabet
	passedChallenges, err := ParseContinueCode("LRo3lzE7XYnWkwaZNdE7i3Hku6TqCQiW8i5NF96H2b0yPxve5Mq4pK18VJmg!&%$&")
	assert.Error(t, err, "Parsing continueCode with invalid chars should have returned error")
	assert.Empty(t, passedChallenges, "Parsing continueCode with invalid chars should return nil as passedChallenges")
}

func TestCompareChallengeStates(t *testing.T) {
	assert.Equal(t, NoOp, CompareChallengeStates([]int{1, 2, 3}, []int{1, 2, 3}), "Should not apply when both are equal")
	assert.Equal(t, NoOp, CompareChallengeStates([]int{}, []int{}), "Should not apply when not are empty")
	assert.Equal(t, NoOp, CompareChallengeStates([]int{1, 2, 4, 3}, []int{1, 2, 3, 4}), "Should not apply when both are equal, even when the ordering is different")

	assert.Equal(t, UpdateCache, CompareChallengeStates([]int{1, 2, 3, 4}, []int{1, 2, 3}), "Should not apply when current one is larger")

	assert.Equal(t, ApplyCode, CompareChallengeStates([]int{}, []int{1}), "Should apply when a challenge is not contained")
	assert.Equal(t, ApplyCode, CompareChallengeStates([]int{1}, []int{1, 2}), "Should apply when a challenge is not contained")
	assert.Equal(t, ApplyCode, CompareChallengeStates([]int{1, 2}, []int{3, 2, 1}), "Should apply when a challenge is not contained and the orders are different")
}
