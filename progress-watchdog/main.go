package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"

	"github.com/iteratec/multi-juicer/progress-watchdog/internal"
	"github.com/op/go-logging"

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

var log = logging.MustGetLogger("ProgressWatchdog")
var format = logging.MustStringFormatter(
	`%{time:2006/01/02 15:04:05} %{message}`,
)

func main() {
	backend := logging.NewLogBackend(os.Stdout, "", 0)

	backendLeveled := logging.AddModuleLevel(backend)
	backendLeveled.SetLevel(logging.INFO, "")

	logging.SetFormatter(format)
	logging.SetBackend(backendLeveled)

	log.Info("Starting ProgressWatchdog")

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

	log.Info("Starting WebServer listening for Solution Webhooks")
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
			log.Errorf("Failed to get deployment for teamname: '%s' received via in webhook", team)
			log.Error(err)
		}

		challengeStatusJson := "[]"
		if json, ok := deployment.Annotations["multi-juicer.iteratec.dev/challenges"]; ok {
			challengeStatusJson = json
		}

		challengeStatus := make(internal.ChallengeStatuses, 0)
		err = json.Unmarshal([]byte(challengeStatusJson), &challengeStatus)
		if err != nil {
			log.Error("Failed to decode json from juice shop deployment annotation")
			log.Error(err)
		}

		challengeStatus = append(challengeStatus, internal.ChallengeStatus{Key: webhook.Solution.Challenge, SolvedAt: webhook.Solution.IssuedOn})
		sort.Stable(challengeStatus)

		internal.PersistProgress(clientset, team, challengeStatus)

		log.Infof("Received Webhook for Team '%s' for Challenge '%s'", team, webhook.Solution.Challenge)

		c.String(http.StatusOK, "ok")
	})
	router.Run()
}
