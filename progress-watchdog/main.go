package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"

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
	Challenge string  `json:"challenge"`
	Evidence  *string `json:"evidence"`
	IssuedOn  string  `json:"issuedOn"`
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

var logger = log.New(os.Stdout, "", log.LstdFlags)
var namespace = os.Getenv("NAMESPACE")

func main() {
	logger.Println("Starting ProgressWatchdog")

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
			logger.Print(fmt.Errorf("failed to get deployment for team: '%s' received via in webhook: %w", team, err))
		}

		challengeStatusJson := "[]"
		if json, ok := deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]; ok {
			challengeStatusJson = json
		}

		challengeStatus := make(internal.ChallengeStatuses, 0)
		err = json.Unmarshal([]byte(challengeStatusJson), &challengeStatus)
		if err != nil {
			logger.Print(fmt.Errorf("failed to decode json from juice shop deployment annotation: %w", err))
		}

		// check if the challenge is already solved
		for _, status := range challengeStatus {
			if status.Key == webhook.Solution.Challenge {
				logger.Printf("Challenge '%s' already solved by team '%s', ignoring webhook", webhook.Solution.Challenge, team)
				responseWriter.WriteHeader(http.StatusOK)
				responseWriter.Write([]byte("ok"))
				return
			}
		}

		challengeStatus = append(challengeStatus, internal.ChallengeStatus{Key: webhook.Solution.Challenge, SolvedAt: webhook.Solution.IssuedOn})
		sort.Stable(challengeStatus)

		internal.PersistProgress(clientset, team, challengeStatus, "", "")

		logger.Printf("Received webhook for team '%s' for challenge '%s'", team, webhook.Solution.Challenge)

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
	logger.Println("Starting web server listening for Solution Webhooks on :8080")
	server.ListenAndServe()
}
