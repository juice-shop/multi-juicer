package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/op/go-logging"
	"github.com/speps/go-hashids"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	types "k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var log = logging.MustGetLogger("ProgressWatchdog")

var format = logging.MustStringFormatter(
	`%{time:15:04:05.000} %{shortfunc}: %{level:.4s} %{message}`,
)

// ContinueCodePayload json format of the get continue code response
type ContinueCodePayload struct {
	ContinueCode string `json:"continueCode"`
}

// ProgressUpdateJobs contains all information required by a ProgressUpdateJobs worker to do its Job
type ProgressUpdateJobs struct {
	Teamname         string
	LastContinueCode string
}

func main() {
	logBackend := logging.NewLogBackend(os.Stdout, "", 0)

	logFormatter := logging.NewBackendFormatter(logBackend, format)
	logBackendLeveled := logging.AddModuleLevel(logBackend)
	logBackendLeveled.SetLevel(logging.INFO, "")

	log.SetBackend(logBackendLeveled)
	logging.SetBackend(logBackendLeveled, logFormatter)

	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	// creates the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	progressUpdateJobs := make(chan ProgressUpdateJobs)

	// Start 10 workers which fetch and update continue codes based on the `progressUpdateJobs` queue / channel
	for i := 0; i < 10; i++ {
		go workOnProgressUpdates(progressUpdateJobs, clientset)
	}

	createProgressUpdateJobs(progressUpdateJobs, clientset)
}

// Constantly lists all JuiceShops in managed by MultiJuicer and queues progressUpdatesJobs for them
func createProgressUpdateJobs(progressUpdateJobs chan<- ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for {
		// Get Instances
		log.Debug("Looking for Instances")
		opts := metav1.ListOptions{
			LabelSelector: "app=juice-shop",
		}

		juiceShops, err := clientset.AppsV1().Deployments("default").List(opts)
		if err != nil {
			panic(err.Error())
		}

		log.Debugf("Found %d JuiceShop running", len(juiceShops.Items))

		for _, instance := range juiceShops.Items {
			teamname := instance.Labels["team"]

			if instance.Status.ReadyReplicas != 1 {
				continue
			}

			log.Debugf("Found instance for team %s", teamname)

			progressUpdateJobs <- ProgressUpdateJobs{
				Teamname:         instance.Labels["team"],
				LastContinueCode: instance.Annotations["multi-juicer.iteratec.dev/continueCode"],
			}
		}
		time.Sleep(5 * time.Second)
	}
}

func workOnProgressUpdates(progressUpdateJobs <-chan ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for job := range progressUpdateJobs {
		log.Debugf("Running ProgressUpdateJob for team '%s'", job.Teamname)
		log.Debug("Fetching cached continue code")
		lastContinueCode := job.LastContinueCode
		log.Debug("Fetching current continue code")
		currentContinueCode := getCurrentContinueCode(job.Teamname)

		if lastContinueCode == "" && currentContinueCode == nil {
			log.Warning("Failed to fetch both current and cached continue code")
		} else if lastContinueCode == "" && currentContinueCode != nil {
			log.Debug("Did not find a cached continue code.")
			log.Debug("Last continue code was nil. This should only happen once per team.")
			cacheContinueCode(clientset, job.Teamname, *currentContinueCode)
		} else if currentContinueCode == nil {
			log.Debug("Could not get current continue code. Juice Shop might be down. Sleeping and retrying in 5 sec")
		} else {
			log.Debug("Checking Difference between continue code")
			if lastContinueCode != *currentContinueCode {
				log.Debugf("Continue codes differ (last vs current): (%s vs %s)", lastContinueCode, *currentContinueCode)
				log.Debug("Applying cached continue code")
				log.Infof("Found new continue Code for Team '%s', updating now", job.Teamname)
				applyContinueCode(job.Teamname, lastContinueCode)
				log.Debug("ReFetching current continue code")
				currentContinueCode = getCurrentContinueCode(job.Teamname)

				log.Debug("Caching current continue code")
				cacheContinueCode(clientset, job.Teamname, *currentContinueCode)
			} else {
				log.Debug("Continue codes are identical. Sleeping")
			}
		}
	}
}

func getCurrentContinueCode(teamname string) *string {
	url := fmt.Sprintf("http://t-%s-juiceshop:3000/rest/continue-code", teamname)

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request")
		log.Warning(err)
		return nil
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to fetch continue code from juice shop.")
		log.Warning(err)
		return nil
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case 200:
		body, err := ioutil.ReadAll(res.Body)

		if err != nil {
			log.Error("Failed to read response body stream.")
			return nil
		}

		continueCodePayload := ContinueCodePayload{}

		err = json.Unmarshal(body, &continueCodePayload)

		if err != nil {
			log.Error("Failed to parse json of a challenge status.")
			log.Error(err)
			return nil
		}

		log.Debugf("Got current continue code: '%s'", continueCodePayload.ContinueCode)

		return &continueCodePayload.ContinueCode
	default:
		log.Warningf("Unexpected response status code '%d'", res.StatusCode)
		return nil
	}
}

func applyContinueCode(teamname, continueCode string) {
	url := fmt.Sprintf("http://t-%s-juiceshop:3000/rest/continue-code/apply/%s", teamname, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request to set the current continue code")
		log.Warning(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to set the current continue code to juice shop.")
		log.Warning(err)
	}
	defer res.Body.Close()
}

// UpdateProgressDeploymentDiff contains only the parts of the deployment we are interessted in updating
type UpdateProgressDeploymentDiff struct {
	Metadata UpdateProgressDeploymentMetadata `json:"metadata"`
}

// UpdateProgressDeploymentMetadata a shim of the k8s metadata object containing only annotations
type UpdateProgressDeploymentMetadata struct {
	Annotations UpdateProgressDeploymentDiffAnnotations `json:"annotations"`
}

// UpdateProgressDeploymentDiffAnnotations the app specific annotations relevant to the `progress-watchdog`
type UpdateProgressDeploymentDiffAnnotations struct {
	ContinueCode     string `json:"multi-juicer.iteratec.dev/continueCode"`
	ChallengesSolved string `json:"multi-juicer.iteratec.dev/challengesSolved"`
}

func cacheContinueCode(clientset *kubernetes.Clientset, teamname string, continueCode string) {
	log.Debugf("Updating continue-code of team '%s' to '%s'", teamname, continueCode)

	challengeCount, err := ParseContinueCode(continueCode)
	if err != nil {
		log.Warningf("Could not decode continueCode '%s'", continueCode)
	}

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: UpdateProgressDeploymentDiffAnnotations{
				ContinueCode:     continueCode,
				ChallengesSolved: fmt.Sprintf("%d", challengeCount),
			},
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		panic("Could not encode json, to update continueCode and challengeSolved count on deployment")
	}

	_, err = clientset.AppsV1().Deployments("default").Patch(fmt.Sprintf("t-%s-juiceshop", teamname), types.MergePatchType, jsonBytes)
	if err != nil {
		log.Errorf("Failed to path new continue code into deployment for team %s", teamname)
		log.Error(err)
	}
}

// ParseContinueCode returns the number of challenges solved by this continue code
func ParseContinueCode(continueCode string) (int, error) {
	hd := hashids.NewData()
	hd.Salt = "this is my salt"
	hd.MinLength = 60
	hd.Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

	hashIDClient, _ := hashids.NewWithData(hd)
	decoded, err := hashIDClient.DecodeWithError(continueCode)

	if err != nil {
		return -1, err
	}

	return len(decoded), nil
}
