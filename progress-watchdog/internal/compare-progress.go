package internal

import "reflect"

// UpdateState defines how two challenge state differ from each other, and indicates which action should be taken
type UpdateState string

const (
	// UpdateCache The cache aka the continue code annotation on the deployment should be updated
	UpdateCache UpdateState = "UpdateCache"
	// ApplyCode The last continue code should be applied to recover lost challenges
	ApplyCode UpdateState = "ApplyCode"
	// NoOp Challenge state is identical, nothing to do 🤷
	NoOp UpdateState = "NoOp"
)

// checks if the ChallengeStatus array contains the specified ChallengeStatus
func contains(s []ChallengeStatus, e ChallengeStatus) bool {
	for _, a := range s {
		if a.Key == e.Key {
			return true
		}
	}
	return false
}

// CompareChallengeStates Compares to current vs last challenge state and decides what should happen next
// This method assumes that both lists are presorted based on the challenge key
func CompareChallengeStates(currentSolvedChallenges, lastSolvedChallenges []ChallengeStatus) UpdateState {
	if len(currentSolvedChallenges) == len(lastSolvedChallenges) && reflect.DeepEqual(currentSolvedChallenges, lastSolvedChallenges) {
		return NoOp
	}

	for _, challengeSolvedInLastContinueCode := range lastSolvedChallenges {
		contained := contains(currentSolvedChallenges, challengeSolvedInLastContinueCode)

		if contained == false {
			return ApplyCode
		}
	}

	return UpdateCache
}
