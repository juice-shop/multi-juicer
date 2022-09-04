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

var log = logging.MustGetLogger("Internal")

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
	Challenges       string `json:"wrongsecrets-ctf-party.iteratec.dev/challenges"`
	ChallengesSolved string `json:"wrongsecrets-ctf-party.iteratec.dev/challengesSolved"`
}

func PersistProgress(clientset *kubernetes.Clientset, teamname string, solvedChallenges []ChallengeStatus) {
	log.Infof("Updating saved ContinueCode of team '%s'", teamname)

	encodedSolvedChallenges, err := json.Marshal(solvedChallenges)
	if err != nil {
		panic("Could not encode json, to update ContinueCode and challengeSolved count on deployment")
	}

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: UpdateProgressDeploymentDiffAnnotations{
				Challenges:       string(encodedSolvedChallenges),
				ChallengesSolved: fmt.Sprintf("%d", len(solvedChallenges)),
			},
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		panic("Could not encode json, to update ContinueCode and challengeSolved count on deployment")
	}

	namespace := os.Getenv("NAMESPACE")
	_, err = clientset.AppsV1().Deployments(namespace).Patch(context.TODO(), fmt.Sprintf("t-%s-juiceshop", teamname), types.MergePatchType, jsonBytes, v1.PatchOptions{})
	if err != nil {
		log.Errorf("Failed to patch new ContinueCode into deployment for team %s", teamname)
		log.Error(err)
	}
}
