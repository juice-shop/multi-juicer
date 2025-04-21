package internal

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/speps/go-hashids/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// Define annotation keys as constants
const (
	AnnotationChallenges         = "multi-juicer.owasp-juice.shop/challenges"
	AnnotationChallengesSolved   = "multi-juicer.owasp-juice.shop/challengesSolved"
	AnnotationContinueCodeFindIt = "multi-juicer.owasp-juice.shop/continueCodeFindIt"
	AnnotationContinueCodeFixIt  = "multi-juicer.owasp-juice.shop/continueCodeFixIt"
)

type ProgressUpdateJobs struct {
	Team                   string
	LastChallengeProgress  []ChallengeStatus
	LastContinueCodeFindIt string // Add FindIt code from annotation
	LastContinueCodeFixIt  string // Add FixIt code from annotation
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
			// Log error instead of panicking
			logger.Printf("ERROR: Failed to list deployments: %v", err)
			time.Sleep(30 * time.Second) // Wait before retrying
			continue
		}

		logger.Printf("Background-sync started syncing %d instances", len(juiceShops.Items))

		for _, instance := range juiceShops.Items {
			team := instance.Labels["team"]
			annotations := instance.GetAnnotations()

			if instance.Status.ReadyReplicas != 1 {
				logger.Printf("Skipping sync for team %s, instance not ready", team)
				continue
			}

			var lastChallengeProgress []ChallengeStatus
			if challengesAnnotation, ok := annotations[AnnotationChallenges]; ok {
				err := json.Unmarshal([]byte(challengesAnnotation), &lastChallengeProgress)
				if err != nil {
					logger.Printf("WARN: Failed to unmarshal challenges annotation for team %s: %v", team, err)
					// Proceed with empty slice, might trigger restore if instance has progress
				}
			}

			progressUpdateJobs <- ProgressUpdateJobs{
				Team:                   team,
				LastChallengeProgress:  lastChallengeProgress,
				LastContinueCodeFindIt: annotations[AnnotationContinueCodeFindIt], // Read FindIt code
				LastContinueCodeFixIt:  annotations[AnnotationContinueCodeFixIt],  // Read FixIt code
			}
		}
		time.Sleep(60 * time.Second)
	}
}

func workOnProgressUpdates(progressUpdateJobs <-chan ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for job := range progressUpdateJobs {
		team := job.Team
		lastChallengeProgress := job.LastChallengeProgress
		lastFindItCode := job.LastContinueCodeFindIt
		lastFixItCode := job.LastContinueCodeFixIt

		// Fetch current state from Juice Shop instance
		currentChallengeProgress, errStandard := getCurrentChallengeProgress(team)
		currentFindItCode, errFindIt := getCurrentFindItCode(team)
		currentFixItCode, errFixIt := getCurrentFixItCode(team)

		if errStandard != nil {
			logger.Println(fmt.Errorf("failed to fetch current Standard Challenge Progress for team '%s': %w", team, errStandard))
			// Decide how to handle partial failure. Maybe skip this cycle?
			continue
		}
		if errFindIt != nil {
			logger.Println(fmt.Errorf("failed to fetch current FindIt Code for team '%s': %w", team, errFindIt))
			// Continue, maybe standard/fixit can still be processed?
			// Or skip? For now, let's assume fetching might fail temporarily.
		}
		if errFixIt != nil {
			logger.Println(fmt.Errorf("failed to fetch current FixIt Code for team '%s': %w", team, errFixIt))
			// Continue?
		}

		// Compare states
		standardState := CompareChallengeStates(currentChallengeProgress, lastChallengeProgress)
		findItState := compareCodes(currentFindItCode, lastFindItCode, errFindIt)
		fixItState := compareCodes(currentFixItCode, lastFixItCode, errFixIt)

		// Determine overall action
		overallState := NoOp
		if standardState == ApplyCode || findItState == ApplyCode || fixItState == ApplyCode {
			overallState = ApplyCode
		} else if standardState == UpdateCache || findItState == UpdateCache || fixItState == UpdateCache {
			overallState = UpdateCache
		}

		switch overallState {
		case ApplyCode:
			logger.Printf("Restoring progress for team '%s'", team)
			applyChallengeProgress(team, lastChallengeProgress) // Apply stored standard progress
			if lastFindItCode != "" {
				applyFindItCode(team, lastFindItCode) // Apply stored FindIt code
			}
			if lastFixItCode != "" {
				applyFixItCode(team, lastFixItCode) // Apply stored FixIt code
			}

			// Refetch after applying to ensure persistence uses the newly set state
			// Although, ideally Apply should make the instance match the last known state,
			// re-fetching adds a layer of verification before potentially overwriting annotations.
			// However, this adds latency and complexity. Let's trust the apply works for now
			// and persist the state we *intended* to apply.
			// If issues arise, re-fetch here.
			PersistProgress(clientset, team, lastChallengeProgress, lastFindItCode, lastFixItCode)

		case UpdateCache:
			// Persist the *currently fetched* state if it differs from the stored state
			logger.Printf("Updating stored progress for team '%s'", team)
			PersistProgress(clientset, team, currentChallengeProgress, currentFindItCode, currentFixItCode)
		case NoOp:
			// logger.Printf("Progress for team '%s' is in sync", team)
		}
	}
}

// Helper to compare fetched code vs stored code, considering fetch errors
func compareCodes(currentCode, lastCode string, fetchErr error) UpdateState {
	if fetchErr != nil {
		// If we couldn't fetch the current code, we can't determine if cache needs updating.
		// If there was a *stored* code, it might imply the instance lost progress (ApplyCode),
		// but we can't be sure without fetching. Safest is NoOp or maybe log a warning.
		// Let's default to NoOp to avoid unnecessary applies/updates on transient fetch errors.
		return NoOp
	}

	if currentCode == lastCode {
		return NoOp
	}

	if currentCode != "" && lastCode == "" {
		// Instance has progress, nothing stored -> UpdateCache
		return UpdateCache
	}

	if currentCode == "" && lastCode != "" {
		// Instance has no progress, but we have it stored -> ApplyCode
		return ApplyCode
	}

	if currentCode != lastCode {
		// Both have codes, but they differ. This implies instance progressed.
		return UpdateCache
	}

	return NoOp // Should not be reached
}

func getCurrentChallengeProgress(team string) ([]ChallengeStatus, error) {
	url := fmt.Sprintf("http://juiceshop-%s:3000/api/challenges", team)

	req, err := http.NewRequest("GET", url, nil) // Use nil for GET body
	if err != nil {
		// Log error instead of panic
		logger.Printf("ERROR: Failed to create http request for standard challenges for team %s: %v", team, err)
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch standard challenge status: %w", err)
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK:
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
		return nil, fmt.Errorf("unexpected response status code '%d' from Juice Shop /api/challenges", res.StatusCode)
	}
}

// Fetches the current FindIt continue code from the Juice Shop instance
func getCurrentFindItCode(team string) (string, error) {
	return getContinueCode(team, "findIt")
}

// Fetches the current FixIt continue code from the Juice Shop instance
func getCurrentFixItCode(team string) (string, error) {
	return getContinueCode(team, "fixIt")
}

// Generic function to fetch continue codes (FindIt/FixIt)
func getContinueCode(team, codeType string) (string, error) {
	// codeType should be 'findIt' or 'fixIt'
	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code-%s", team, codeType)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		logger.Printf("ERROR: Failed to create http request for %s code for team %s: %v", codeType, team, err)
		return "", fmt.Errorf("failed to create http request for %s code: %w", codeType, err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch %s code: %w", codeType, err)
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK:
		var response map[string]string
		err = json.NewDecoder(res.Body).Decode(&response)
		if err != nil {
			return "", fmt.Errorf("failed to parse JSON response for %s code: %w", codeType, err)
		}
		code, ok := response["continueCode"]
		if !ok {
			return "", fmt.Errorf("'continueCode' field not found in %s response", codeType)
		}
		return code, nil
	case http.StatusNotFound: // Handle cases where the endpoint might not exist or no code is generated yet
		logger.Printf("WARN: No %s code found for team %s (status 404)", codeType, team)
		return "", nil // Return empty string, not an error
	default:
		return "", fmt.Errorf("unexpected status code %d fetching %s code", res.StatusCode, codeType)
	}
}

// Applies the stored standard challenge progress to the Juice Shop instance
func applyChallengeProgress(team string, challengeProgress []ChallengeStatus) {
	continueCode, err := GenerateContinueCode(challengeProgress)
	if err != nil {
		logger.Println(fmt.Errorf("failed to generate standard continue code for team %s: %w", team, err))
		return
	}
	if continueCode == "" {
		logger.Printf("Skipping application of empty standard progress for team %s", team)
		return // Don't try to apply an empty code
	}

	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code/apply/%s", team, continueCode)
	err = applyCodeToEndpoint(url, "standard", team)
	if err != nil {
		logger.Println(fmt.Errorf("failed to apply standard progress for team %s: %w", team, err))
	}
}

// Applies the stored FindIt continue code to the Juice Shop instance
func applyFindItCode(team string, code string) {
	if code == "" {
		logger.Printf("Skipping application of empty FindIt code for team %s", team)
		return
	}
	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code-findIt/apply/%s", team, code)
	err := applyCodeToEndpoint(url, "FindIt", team)
	if err != nil {
		logger.Println(fmt.Errorf("failed to apply FindIt code for team %s: %w", team, err))
	}
}

// Applies the stored FixIt continue code to the Juice Shop instance
func applyFixItCode(team string, code string) {
	if code == "" {
		logger.Printf("Skipping application of empty FixIt code for team %s", team)
		return
	}
	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code-fixIt/apply/%s", team, code)
	err := applyCodeToEndpoint(url, "FixIt", team)
	if err != nil {
		logger.Println(fmt.Errorf("failed to apply FixIt code for team %s: %w", team, err))
	}
}

// Generic function to apply a continue code via PUT request
func applyCodeToEndpoint(url string, codeType string, team string) error {
	req, err := http.NewRequest("PUT", url, nil) // Use nil for PUT body
	if err != nil {
		return fmt.Errorf("failed to create http request to apply %s code: %w", codeType, err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call apply endpoint for %s code: %w", codeType, err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		// Read body for potential error message from Juice Shop
		bodyBytes, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected status code %d when applying %s code. Body: %s", res.StatusCode, codeType, string(bodyBytes))
	}
	logger.Printf("Successfully applied %s progress/code for team %s", codeType, team)
	return nil
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
