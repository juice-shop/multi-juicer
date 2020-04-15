package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"reflect"
	"sort"
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

// ContinueCodePayload json format of the get ContinueCode response
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
	logBackendLeveled.SetLevel(logging.DEBUG, "")

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

	workerCount := 10
	log.Infof("Starting ProgressWatchdog with %d worker go routines", workerCount)

	// Start 10 workers which fetch and update ContinueCodes based on the `progressUpdateJobs` queue / channel
	for i := 0; i < workerCount; i++ {
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

		namespace := os.Getenv("NAMESPACE")
		juiceShops, err := clientset.AppsV1().Deployments(namespace).List(opts)
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
		lastContinueCode := job.LastContinueCode
		log.Debug("Fetching current ContinueCode")
		currentContinueCode, err := getCurrentContinueCode(job.Teamname)

		if err != nil {
			log.Warningf("Failed to fetch ContinueCode for team '%s' from Juice Shop", job.Teamname)
			log.Warning(err)
			continue
		}

		log.Debug("Checking Difference between ContinueCode")

		currentSolvedChallenges, _ := ParseContinueCode(currentContinueCode)
		lastSolvedChallenges, _ := ParseContinueCode(lastContinueCode)

		switch CompareChallengeStates(currentSolvedChallenges, lastSolvedChallenges) {
		case ApplyCode:
			log.Debugf("ContinueCodes differ (current vs last): (%s vs %s)", currentContinueCode, lastContinueCode)
			log.Debug("Applying cached ContinueCode")
			log.Infof("Last ContinueCode for team '%s' contains unsolved challenges", job.Teamname)
			applyContinueCode(job.Teamname, lastContinueCode)

			log.Debug("ReFetching current ContinueCode")
			currentContinueCode, err = getCurrentContinueCode(job.Teamname)

			if err != nil {
				log.Errorf("Failed to fetch ContinueCode from Juice Shop for team '%s' to reapply it", job.Teamname)
				log.Error(err)
				continue
			}

			log.Debug("Caching current ContinueCode")
			cacheContinueCode(clientset, job.Teamname, currentContinueCode)
		case UpdateCache:
			cacheContinueCode(clientset, job.Teamname, currentContinueCode)
		case NoOp:
			log.Debug("No need to apply ContinueCode, Skipping")
		}
	}
}

func getCurrentContinueCode(teamname string) (string, error) {
	url := fmt.Sprintf("http://t-%s-juiceshop:3000/rest/continue-code", teamname)

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request")
		log.Warning(err)
		panic("Failed to create http request")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to fetch ContinueCode from juice shop")
		log.Warning(err)
		return "", errors.New("Failed to fetch ContinueCode")
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case 200:
		body, err := ioutil.ReadAll(res.Body)

		if err != nil {
			log.Error("Failed to read response body stream")
			return "", errors.New("Failed to response body stream from Juice Shop")
		}

		continueCodePayload := ContinueCodePayload{}

		err = json.Unmarshal(body, &continueCodePayload)

		if err != nil {
			log.Error("Failed to parse json of a challenge status")
			log.Error(err)
			return "", errors.New("Failed to parse JSON from Juice Shop ContinueCode response")
		}

		log.Debugf("Got current ContinueCode: '%s'", continueCodePayload.ContinueCode)

		return continueCodePayload.ContinueCode, nil
	default:
		return "", fmt.Errorf("Unexpected response status code '%d' from Juice Shop", res.StatusCode)
	}
}

func applyContinueCode(teamname, continueCode string) {
	url := fmt.Sprintf("http://t-%s-juiceshop:3000/rest/continue-code/apply/%s", teamname, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request to set the current ContinueCode")
		log.Warning(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to set the current ContinueCode to juice shop")
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
	log.Infof("Updating saved ContinueCode of team '%s'", teamname)

	solvedChallenges, err := ParseContinueCode(continueCode)
	if err != nil {
		log.Warningf("Could not decode continueCode '%s'", continueCode)
	}

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: UpdateProgressDeploymentDiffAnnotations{
				ContinueCode:     continueCode,
				ChallengesSolved: fmt.Sprintf("%d", len(solvedChallenges)),
			},
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		panic("Could not encode json, to update ContinueCode and challengeSolved count on deployment")
	}

	namespace := os.Getenv("NAMESPACE")
	_, err = clientset.AppsV1().Deployments(namespace).Patch(fmt.Sprintf("t-%s-juiceshop", teamname), types.MergePatchType, jsonBytes)
	if err != nil {
		log.Errorf("Failed to patch new ContinueCode into deployment for team %s", teamname)
		log.Error(err)
	}
}

func contains(s []int, e int) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// UpdateState defines how two challenge state differ from each other, and indicates which action should be taken
type UpdateState string

const (
	// UpdateCache The cache aka the continue code annotation on the deployment should be updated
	UpdateCache UpdateState = "UpdateCache"
	// ApplyCode The last continue code should be applied to recover lost challenges
	ApplyCode UpdateState = "ApplyCode"
	// NoOp Challenge state is identical, nothing to do 🤷
	NoOp UpdateState = "NoOp"
)

// CompareChallengeStates Compares to current vs last challenge state and decides what should happen next
func CompareChallengeStates(currentSolvedChallenges, lastSolvedChallenges []int) UpdateState {
	for _, challengeSolvedInLastContinueCode := range lastSolvedChallenges {
		contained := contains(currentSolvedChallenges, challengeSolvedInLastContinueCode)

		if contained == false {
			return ApplyCode
		}
	}

	sort.Ints(currentSolvedChallenges)
	sort.Ints(lastSolvedChallenges)
	if reflect.DeepEqual(currentSolvedChallenges, lastSolvedChallenges) {
		return NoOp
	}
	return UpdateCache
}

// ParseContinueCode returns the number of challenges solved by this ContinueCode
func ParseContinueCode(continueCode string) ([]int, error) {
	hd := hashids.NewData()
	hd.Salt = "this is my salt"
	hd.MinLength = 60
	hd.Alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"

	hashIDClient, _ := hashids.NewWithData(hd)
	decoded, err := hashIDClient.DecodeWithError(continueCode)

	if err != nil {
		return make([]int, 0), err
	}

	return decoded, nil
}
