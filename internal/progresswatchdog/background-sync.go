package progresswatchdog

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/speps/go-hashids/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const workerCount = 10

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
var challengeIdLookupOnce sync.Once

// JuiceShopChallenge represents a challenge in the Juice Shop config file. reduced to just the key, everything else is not needed
type JuiceShopChallenge struct {
	Key string `json:"key"`
}

// StartBackgroundSync runs the JuiceShop progress reconciliation loop. It blocks until ctx is cancelled.
// It must run on at most one balancer replica at a time (gated via leader election).
func StartBackgroundSync(ctx context.Context, b *bundle.Bundle) {
	b.Log.Info("Starting background-sync looking for JuiceShop challenge progress changes", "workers", workerCount)

	challengeIdLookupOnce.Do(createChallengeIdLookup)

	progressUpdateJobs := make(chan ProgressUpdateJobs)

	var wg sync.WaitGroup
	for range workerCount {
		wg.Go(func() {
			workOnProgressUpdates(ctx, b, progressUpdateJobs)
		})
	}

	createProgressUpdateJobs(ctx, b, progressUpdateJobs)

	close(progressUpdateJobs)
	wg.Wait()
	b.Log.Info("Background-sync stopped")
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

// Lists all JuiceShops managed by MultiJuicer and queues progressUpdateJobs for them, looping until ctx is cancelled.
func createProgressUpdateJobs(ctx context.Context, b *bundle.Bundle, progressUpdateJobs chan<- ProgressUpdateJobs) {
	for {
		opts := metav1.ListOptions{
			LabelSelector: "app.kubernetes.io/name=juice-shop",
		}
		juiceShops, err := b.ClientSet.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).List(ctx, opts)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			b.Log.Error("Failed to list JuiceShop deployments", "error", err)
		} else {
			b.Log.Debug("Background-sync started syncing instances", "count", len(juiceShops.Items))

			for _, instance := range juiceShops.Items {
				team := instance.Labels["team"]

				if instance.Status.ReadyReplicas != 1 {
					continue
				}

				var lastChallengeProgress []ChallengeStatus
				json.Unmarshal([]byte(instance.Annotations["multi-juicer.owasp-juice.shop/challenges"]), &lastChallengeProgress)

				select {
				case <-ctx.Done():
					return
				case progressUpdateJobs <- ProgressUpdateJobs{
					Team:                  team,
					LastChallengeProgress: lastChallengeProgress,
				}:
				}
			}
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(60 * time.Second):
		}
	}
}

func workOnProgressUpdates(ctx context.Context, b *bundle.Bundle, progressUpdateJobs <-chan ProgressUpdateJobs) {
	for job := range progressUpdateJobs {
		lastChallengeProgress := job.LastChallengeProgress
		challengeProgress, err := getCurrentChallengeProgress(job.Team)

		if err != nil {
			b.Log.Error("failed to fetch current Challenge Progress from Juice Shop", "team", job.Team, "error", err)
			continue
		}

		switch CompareChallengeStates(challengeProgress, lastChallengeProgress) {
		case ApplyCode:
			b.Log.Debug("Last ContinueCode contains unsolved challenges", "team", job.Team)
			applyChallengeProgress(b.Log, job.Team, lastChallengeProgress)

			challengeProgress, err = getCurrentChallengeProgress(job.Team)

			if err != nil {
				b.Log.Error("failed to re-fetch challenge progress from Juice Shop to reapply it", "team", job.Team, "error", err)
				continue
			}
			PersistProgress(ctx, b, job.Team, challengeProgress, nil)
		case UpdateCache:
			PersistProgress(ctx, b, job.Team, challengeProgress, nil)
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

func applyChallengeProgress(log *slog.Logger, team string, challengeProgress []ChallengeStatus) {
	continueCode, err := GenerateContinueCode(challengeProgress)
	if err != nil {
		log.Error("failed to encode challenge progress into continue code", "error", err)
		return
	}

	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code/apply/%s", team, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Error("failed to create http request to set the current ContinueCode", "error", err)
		return
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Error("failed to set the current ContinueCode to juice shop", "error", err)
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
