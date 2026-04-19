package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/juice-shop/multi-juicer/progress-watchdog/internal"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ContinueCodePayload json format of the get ContinueCode response
type ContinueCodePayload struct {
	ContinueCode string `json:"continueCode"`
}

// ProgressUpdateJobs contains all information required by a ProgressUpdateJobs worker to do its Job
type ProgressUpdateJobs struct {
	Teamname         string
	LastContinueCode string
}

type JuiceShopWebhookSolution struct {
	Challenge       string   `json:"challenge"`
	Evidence        *string  `json:"evidence"`
	IssuedOn        string   `json:"issuedOn"`
	CheatScore      *float64 `json:"cheatScore"`
	TotalCheatScore *float64 `json:"totalCheatScore"`
}

type JuiceShopWebhookIssuer struct {
	HostName string `json:"hostName"`
	Os       string `json:"os"`
	AppName  string `json:"appName"`
	Config   string `json:"config"`
	Version  string `json:"version"`
}
type JuiceShopWebhook struct {
	Solution JuiceShopWebhookSolution `json:"solution"`
	CtfFlag  string                   `json:"ctfFlag"`
	Issuer   JuiceShopWebhookIssuer   `json:"issuer"`
}

var namespace = os.Getenv("NAMESPACE")

func main() {
	internal.Logger.Info("Starting ProgressWatchdog")

	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	// creates the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	const numberWorkers = 10
	internal.StartBackgroundSync(clientset, numberWorkers)

	router := http.NewServeMux()
	router.HandleFunc("POST /team/{team}/webhook", func(responseWriter http.ResponseWriter, req *http.Request) {
		team := req.PathValue("team")
		var webhook JuiceShopWebhook

		err := json.NewDecoder(req.Body).Decode(&webhook)
		if err != nil {
			http.Error(responseWriter, "invalid json", http.StatusBadRequest)
			return
		}

		deployment, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		if err != nil {
			internal.Logger.Error("failed to get deployment for team received via webhook", "team", team, "error", err)
		}

		challengeStatusJson := "[]"
		if json, ok := deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]; ok {
			challengeStatusJson = json
		}

		challengeStatus := make(internal.ChallengeStatuses, 0)
		err = json.Unmarshal([]byte(challengeStatusJson), &challengeStatus)
		if err != nil {
			internal.Logger.Error("failed to decode json from juice shop deployment annotation", "error", err)
		}

		// Read existing cheat scores from the deployment annotation
		cheatScoresJson := "[]"
		if json, ok := deployment.Annotations["multi-juicer.owasp-juice.shop/cheatScores"]; ok {
			cheatScoresJson = json
		}

		cheatScores := make([]internal.CheatScoreEntry, 0)
		err = json.Unmarshal([]byte(cheatScoresJson), &cheatScores)
		if err != nil {
			internal.Logger.Error("failed to decode cheat scores from juice shop deployment annotation", "error", err)
			cheatScores = make([]internal.CheatScoreEntry, 0)
		}

		// check if the challenge is already solved
		for _, status := range challengeStatus {
			if status.Key == webhook.Solution.Challenge {
				internal.Logger.Info("Challenge already solved, ignoring webhook", "challenge", webhook.Solution.Challenge, "team", team)
				responseWriter.WriteHeader(http.StatusOK)
				responseWriter.Write([]byte("ok"))
				return
			}
		}

		// Parse and normalize the timestamp to UTC to ensure consistency
		solvedAtTime, err := time.Parse(time.RFC3339, webhook.Solution.IssuedOn)
		if err != nil {
			internal.Logger.Warn("Failed to parse timestamp, using current time in UTC", "timestamp", webhook.Solution.IssuedOn, "error", err)
			solvedAtTime = time.Now().UTC()
		}
		// Always store timestamps in UTC with RFC3339 format
		solvedAtUTC := solvedAtTime.UTC().Format(time.RFC3339)

		// Create the new challenge status entry
		newChallengeStatus := internal.ChallengeStatus{
			Key:      webhook.Solution.Challenge,
			SolvedAt: solvedAtUTC,
		}

		challengeStatus = append(challengeStatus, newChallengeStatus)
		sort.Stable(challengeStatus)

		// If totalCheatScore is present in the webhook, append it to the cheat scores list
		if webhook.Solution.TotalCheatScore != nil {
			cheatScores = append(cheatScores, internal.CheatScoreEntry{
				TotalCheatScore: *webhook.Solution.TotalCheatScore,
				Timestamp:       solvedAtUTC,
			})
		}

		internal.PersistProgress(clientset, team, challengeStatus, cheatScores)

		internal.Logger.Info("Received webhook", "team", team, "challenge", webhook.Solution.Challenge)

		responseWriter.WriteHeader(http.StatusOK)
		responseWriter.Write([]byte("ok"))
	})

	router.HandleFunc("GET /ready", func(responseWriter http.ResponseWriter, req *http.Request) {
		responseWriter.WriteHeader(http.StatusOK)
		responseWriter.Write([]byte("ok"))
	})

	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}
	internal.Logger.Info("Starting web server listening for Solution Webhooks on :8080")
	server.ListenAndServe()
}
