package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

type ChallengeStatus struct {
	Key      string `json:"key"`
	SolvedAt string `json:"solvedAt"`
}

type ChallengeStatuses []ChallengeStatus

func (a ChallengeStatuses) Len() int           { return len(a) }
func (a ChallengeStatuses) Less(i, j int) bool { return strings.Compare(a[i].Key, a[j].Key) >= 0 }
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
	Challenges         string `json:"multi-juicer.owasp-juice.shop/challenges"`
	ChallengesSolved   string `json:"multi-juicer.owasp-juice.shop/challengesSolved"`
	ContinueCodeFindIt string `json:"multi-juicer.owasp-juice.shop/continueCodeFindIt,omitempty"`
	ContinueCodeFixIt  string `json:"multi-juicer.owasp-juice.shop/continueCodeFixIt,omitempty"`
}

func PersistProgress(clientset *kubernetes.Clientset, team string, solvedChallenges []ChallengeStatus, continueCodeFindIt string, continueCodeFixIt string) {
	logger.Printf("Updating saved progress annotations for team '%s'", team)

	encodedSolvedChallenges, err := json.Marshal(solvedChallenges)
	if err != nil {
		logger.Printf("ERROR: Could not encode json for standard challenges for team %s: %v", team, err)
		return
	}

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: UpdateProgressDeploymentDiffAnnotations{
				Challenges:         string(encodedSolvedChallenges),
				ChallengesSolved:   fmt.Sprintf("%d", len(solvedChallenges)),
				ContinueCodeFindIt: continueCodeFindIt,
				ContinueCodeFixIt:  continueCodeFixIt,
			},
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		logger.Printf("ERROR: Could not encode json for deployment patch for team %s: %v", team, err)
		return
	}

	namespace := os.Getenv("NAMESPACE")
	_, err = clientset.AppsV1().Deployments(namespace).Patch(context.TODO(), fmt.Sprintf("juiceshop-%s", team), types.MergePatchType, jsonBytes, v1.PatchOptions{})
	if err != nil {
		logger.Println(fmt.Errorf("failed to patch progress annotations into deployment for team %s: %w", team, err))
	}
}
