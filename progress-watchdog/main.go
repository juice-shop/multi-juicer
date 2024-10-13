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

	"github.com/gin-gonic/gin"
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

	router := gin.New()
	router.POST("/team/:team/webhook", func(c *gin.Context) {
		team := c.Param("team")
		var webhook JuiceShopWebhook
		if err := c.ShouldBindJSON(&webhook); err != nil {
			c.String(http.StatusBadRequest, "not ok")
			return
		}

		namespace := os.Getenv("NAMESPACE")
		deployment, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), fmt.Sprintf("t-%s-juiceshop", team), metav1.GetOptions{})
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
				c.String(http.StatusOK, "ok")
				return
			}
		}

		challengeStatus = append(challengeStatus, internal.ChallengeStatus{Key: webhook.Solution.Challenge, SolvedAt: webhook.Solution.IssuedOn})
		sort.Stable(challengeStatus)

		internal.PersistProgress(clientset, team, challengeStatus)

		logger.Printf("Received webhook for team '%s' for challenge '%s'", team, webhook.Solution.Challenge)

		c.String(http.StatusOK, "ok")
	})
	logger.Println("Starting web server listening for Solution Webhooks on :8080")
	router.Run()
}
