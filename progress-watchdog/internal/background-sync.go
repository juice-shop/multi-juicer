package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/speps/go-hashids/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type ProgressUpdateJobs struct {
	Team                  string
	LastChallengeProgress []ChallengeStatus
}

type ChallengeResponse struct {
	Status string      `json:"status"`
	Data   []Challenge `json:"data"`
}
type Challenge struct {
	Id          int    `json:"id"`
	Name        string `json:"name"`
	Key         string `json:"key"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Difficulty  int    `json:"difficulty"`
	Solved      bool   `json:"solved"`
	UpdatedAt   string `json:"updatedAt"`
}

var challengeIdLookup = map[string]int{}

// JuiceShopChallenge represents a challenge in the Juice Shop config file. reduced to just the key, everything else is not needed
type JuiceShopChallenge struct {
	Key string `json:"key"`
}

func StartBackgroundSync(clientset *kubernetes.Clientset, workerCount int) {
	logger.Printf("Starting background-sync looking for JuiceShop challenge progress changes with %d workers", workerCount)

	createChallengeIdLookup()

	progressUpdateJobs := make(chan ProgressUpdateJobs)

	// Start 10 workers which fetch and update ContinueCodes based on the `progressUpdateJobs` queue / channel
	for i := 0; i < workerCount; i++ {
		go workOnProgressUpdates(progressUpdateJobs, clientset)
	}

	go createProgressUpdateJobs(progressUpdateJobs, clientset)
}

func createChallengeIdLookup() {
	challengesBytes, err := os.ReadFile("/challenges.json")
	if err != nil {
		panic(fmt.Errorf("failed to read challenges.json. This is fatal as the progress watchdog needs it to map between challenge keys and challenge ids: %w", err))
	}

	var challenges []JuiceShopChallenge
	err = json.Unmarshal(challengesBytes, &challenges)
	if err != nil {
		panic(fmt.Errorf("failed to decode challenges.json. This is fatal as the progress watchdog needs it to map between challenge keys and challenge ids: %w", err))
	}

	for i, challenge := range challenges {
		challengeIdLookup[challenge.Key] = i + 1
	}
}

// Constantly lists all JuiceShops in managed by MultiJuicer and queues progressUpdatesJobs for them
func createProgressUpdateJobs(progressUpdateJobs chan<- ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	namespace := os.Getenv("NAMESPACE")
	for {
		// Get Instances
		opts := metav1.ListOptions{
			LabelSelector: "app.kubernetes.io/name=juice-shop",
		}
		juiceShops, err := clientset.AppsV1().Deployments(namespace).List(context.TODO(), opts)
		if err != nil {
			panic(err.Error())
		}

		logger.Printf("Background-sync started syncing %d instances", len(juiceShops.Items))

		for _, instance := range juiceShops.Items {
			Team := instance.Labels["team"]

			if instance.Status.ReadyReplicas != 1 {
				continue
			}

			var lastChallengeProgress []ChallengeStatus
			json.Unmarshal([]byte(instance.Annotations["multi-juicer.owasp-juice.shop/challenges"]), &lastChallengeProgress)

			progressUpdateJobs <- ProgressUpdateJobs{
				Team:                  Team,
				LastChallengeProgress: lastChallengeProgress,
			}
		}
		time.Sleep(60 * time.Second)
	}
}

func workOnProgressUpdates(progressUpdateJobs <-chan ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for job := range progressUpdateJobs {
		lastChallengeProgress := job.LastChallengeProgress
		challengeProgress, err := getCurrentChallengeProgress(job.Team)

		if err != nil {
			logger.Println(fmt.Errorf("failed to fetch current Challenge Progress for team '%s' from Juice Shop: %w", job.Team, err))
			continue
		}

		switch CompareChallengeStates(challengeProgress, lastChallengeProgress) {
		case ApplyCode:
			logger.Printf("Last ContinueCode for team '%s' contains unsolved challenges", job.Team)
			applyChallengeProgress(job.Team, lastChallengeProgress)

			challengeProgress, err = getCurrentChallengeProgress(job.Team)

			if err != nil {
				logger.Println(fmt.Errorf("failed to re-fetch challenge progress from Juice Shop for team '%s' to reapply it: %w", job.Team, err))
				continue
			}
			PersistProgress(clientset, job.Team, challengeProgress)
		case UpdateCache:
			PersistProgress(clientset, job.Team, challengeProgress)
		case NoOp:
		}
	}
}

func getCurrentChallengeProgress(team string) ([]ChallengeStatus, error) {
	url := fmt.Sprintf("http://juiceshop-%s:3000/api/challenges", team)

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		panic("Failed to create http request")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New("failed to fetch Challenge Status")
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case 200:
		defer res.Body.Close()

		challengeResponse := ChallengeResponse{}

		err = json.NewDecoder(res.Body).Decode(&challengeResponse)
		if err != nil {
			return nil, errors.New("failed to parse JSON from Juice Shop Challenge Status response")
		}

		challengeStatus := make(ChallengeStatuses, 0)

		for _, challenge := range challengeResponse.Data {
			if challenge.Solved {
				challengeStatus = append(challengeStatus, ChallengeStatus{
					Key:      challenge.Key,
					SolvedAt: challenge.UpdatedAt,
				})
			}
		}

		sort.Stable(challengeStatus)

		return challengeStatus, nil
	default:
		return nil, fmt.Errorf("unexpected response status code '%d' from Juice Shop", res.StatusCode)
	}
}

func applyChallengeProgress(team string, challengeProgress []ChallengeStatus) {
	continueCode, err := GenerateContinueCode(challengeProgress)
	if err != nil {
		logger.Println(fmt.Errorf("failed to encode challenge progress into continue code: %w", err))
		return
	}

	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code/apply/%s", team, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		logger.Println(fmt.Errorf("failed to create http request to set the current ContinueCode: %w", err))
		return
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		logger.Println(fmt.Errorf("failed to set the current ContinueCode to juice shop: %w", err))
		return
	}
	defer res.Body.Close()
}

// ParseContinueCode returns the number of challenges solved by this ContinueCode
func GenerateContinueCode(challenges []ChallengeStatus) (string, error) {
	hd := hashids.NewData()
	hd.Salt = "this is my salt"
	hd.MinLength = 60
	hd.Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

	hashIDClient, _ := hashids.NewWithData(hd)

	challengeIds := []int{}

	for _, challenge := range challenges {
		challengeIds = append(challengeIds, challengeIdLookup[challenge.Key])
	}

	continueCode, err := hashIDClient.Encode(challengeIds)

	if err != nil {
		return "", err
	}

	return continueCode, nil
}
