package progresswatchdog

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type CheatScoreEntry struct {
	TotalCheatScore float64 `json:"totalCheatScore"`
	Timestamp       string  `json:"timestamp"`
}

type ChallengeStatus struct {
	Key      string `json:"key"`
	SolvedAt string `json:"solvedAt"`
}

type ChallengeStatuses []ChallengeStatus

func (a ChallengeStatuses) Len() int           { return len(a) }
func (a ChallengeStatuses) Less(i, j int) bool { return strings.Compare(a[i].Key, a[j].Key) > 0 }
func (a ChallengeStatuses) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }

type UpdateProgressDeploymentDiff struct {
	Metadata UpdateProgressDeploymentMetadata `json:"metadata"`
}

// UpdateProgressDeploymentMetadata a shim of the k8s metadata object containing only annotations
type UpdateProgressDeploymentMetadata struct {
	Annotations UpdateProgressDeploymentDiffAnnotations `json:"annotations"`
}

// UpdateProgressDeploymentDiffAnnotations the app specific annotations relevant to the `progress-watchdog`
type UpdateProgressDeploymentDiffAnnotations struct {
	Challenges       string `json:"multi-juicer.owasp-juice.shop/challenges"`
	ChallengesSolved string `json:"multi-juicer.owasp-juice.shop/challengesSolved"`
	CheatScores      string `json:"multi-juicer.owasp-juice.shop/cheatScores,omitempty"`
}

func PersistProgress(ctx context.Context, b *bundle.Bundle, team string, solvedChallenges []ChallengeStatus, cheatScores []CheatScoreEntry) {
	b.Log.Debug("Updating saved ContinueCode", "team", team)

	encodedSolvedChallenges, err := json.Marshal(solvedChallenges)
	if err != nil {
		panic("Could not encode json, to update ContinueCode and challengeSolved count on deployment")
	}

	annotations := UpdateProgressDeploymentDiffAnnotations{
		Challenges:       string(encodedSolvedChallenges),
		ChallengesSolved: fmt.Sprintf("%d", len(solvedChallenges)),
	}

	if len(cheatScores) > 0 {
		encodedCheatScores, err := json.Marshal(cheatScores)
		if err != nil {
			b.Log.Error("failed to encode cheat scores", "team", team, "error", err)
		} else {
			annotations.CheatScores = string(encodedCheatScores)
		}
	}

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: annotations,
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		panic("Could not encode json, to update ContinueCode and challengeSolved count on deployment")
	}

	_, err = b.ClientSet.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Patch(ctx, fmt.Sprintf("juiceshop-%s", team), types.MergePatchType, jsonBytes, v1.PatchOptions{})
	if err != nil {
		b.Log.Error("failed to patch new ContinueCode into deployment", "team", team, "error", err)
	}
}
