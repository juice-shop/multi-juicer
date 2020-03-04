package main

import (
	"testing"
)

func TestParsesContinueCodes(t *testing.T) {
	passedChallenges, err := ParseContinueCode("LRo3lzE7XYnWkwaZNdE7i3Hku6TqCQiW8i5NF96H2b0yPxve5Mq4pK18VJmg")

	if err != nil {
		t.Errorf("Parsing continueCode returned unexpected error '%s'", err)
	}
	if 10 != passedChallenges {
		t.Errorf("Parsing continueCode solved a different number of challenges than expected. Expected %d, was '%d'", 10, passedChallenges)
	}
}

func TestReturnsErrorOnInvalidCodes(t *testing.T) {
	// Contains chars not in the alphabet
	passedChallenges, err := ParseContinueCode("LRo3lzE7XYnWkwaZNdE7i3Hku6TqCQiW8i5NF96H2b0yPxve5Mq4pK18VJmg!&%$&")

	if err == nil {
		t.Error("Parsing continueCode with invalid chars should have returned error but was nil")
	}
	if -1 != passedChallenges {
		t.Errorf("Parsing continueCode with invalid chars should return -1 a challenge Count")
	}
}
