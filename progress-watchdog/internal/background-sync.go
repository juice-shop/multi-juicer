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

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type ProgressUpdateJobs struct {
	Teamname              string
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

var challengeIdLookup = map[string]int{
	"restfulXssChallenge":                       1,
	"accessLogDisclosureChallenge":              2,
	"registerAdminChallenge":                    3,
	"adminSectionChallenge":                     4,
	"fileWriteChallenge":                        5,
	"resetPasswordBjoernOwaspChallenge":         6,
	"tokenSaleChallenge":                        7,
	"rceChallenge":                              8,
	"captchaBypassChallenge":                    9,
	"changePasswordBenderChallenge":             10,
	"christmasSpecialChallenge":                 11,
	"usernameXssChallenge":                      12,
	"persistedXssUserChallenge":                 13,
	"directoryListingChallenge":                 14,
	"localXssChallenge":                         15,
	"dbSchemaChallenge":                         16,
	"deprecatedInterfaceChallenge":              17,
	"easterEggLevelOneChallenge":                18,
	"emailLeakChallenge":                        19,
	"ephemeralAccountantChallenge":              20,
	"errorHandlingChallenge":                    21,
	"manipulateClockChallenge":                  22,
	"extraLanguageChallenge":                    23,
	"feedbackChallenge":                         24,
	"forgedCouponChallenge":                     25,
	"forgedFeedbackChallenge":                   26,
	"forgedReviewChallenge":                     27,
	"jwtForgedChallenge":                        28,
	"forgottenDevBackupChallenge":               29,
	"forgottenBackupChallenge":                  30,
	"typosquattingAngularChallenge":             31,
	"ghostLoginChallenge":                       32,
	"dataExportChallenge":                       33,
	"httpHeaderXssChallenge":                    34,
	"continueCodeChallenge":                     35,
	"dlpPasswordSprayingChallenge":              36,
	"dlpPastebinDataLeakChallenge":              37,
	"typosquattingNpmChallenge":                 38,
	"loginAdminChallenge":                       39,
	"loginAmyChallenge":                         40,
	"loginBenderChallenge":                      41,
	"oauthUserPasswordChallenge":                42,
	"loginJimChallenge":                         43,
	"loginRapperChallenge":                      44,
	"loginSupportChallenge":                     45,
	"basketManipulateChallenge":                 46,
	"misplacedSignatureFileChallenge":           47,
	"timingAttackChallenge":                     48,
	"easterEggLevelTwoChallenge":                49,
	"noSqlCommandChallenge":                     50,
	"noSqlOrdersChallenge":                      51,
	"noSqlReviewsChallenge":                     52,
	"redirectCryptoCurrencyChallenge":           53,
	"weakPasswordChallenge":                     54,
	"negativeOrderChallenge":                    55,
	"premiumPaywallChallenge":                   56,
	"privacyPolicyChallenge":                    57,
	"privacyPolicyProofChallenge":               58,
	"changeProductChallenge":                    59,
	"reflectedXssChallenge":                     60,
	"passwordRepeatChallenge":                   61,
	"resetPasswordBenderChallenge":              62,
	"resetPasswordBjoernChallenge":              63,
	"resetPasswordJimChallenge":                 64,
	"resetPasswordMortyChallenge":               65,
	"retrieveBlueprintChallenge":                66,
	"ssrfChallenge":                             67,
	"sstiChallenge":                             68,
	"scoreBoardChallenge":                       69,
	"securityPolicyChallenge":                   70,
	"persistedXssFeedbackChallenge":             71,
	"hiddenImageChallenge":                      72,
	"rceOccupyChallenge":                        73,
	"supplyChainAttackChallenge":                74,
	"twoFactorAuthUnsafeSecretStorageChallenge": 75,
	"jwtUnsignedChallenge":                      76,
	"uploadSizeChallenge":                       77,
	"uploadTypeChallenge":                       78,
	"unionSqlInjectionChallenge":                79,
	"videoXssChallenge":                         80,
	"basketAccessChallenge":                     81,
	"knownVulnerableComponentChallenge":         82,
	"weirdCryptoChallenge":                      83,
	"redirectChallenge":                         84,
	"xxeFileDisclosureChallenge":                85,
	"xxeDosChallenge":                           86,
	"zeroStarsChallenge":                        87,
	"missingEncodingChallenge":                  88,
	"svgInjectionChallenge":                     89,
	"exposedMetricsChallenge":                   90,
	"freeDeluxeChallenge":                       91,
	"csrfChallenge":                             92,
	"xssBonusChallenge":                         93,
	"resetPasswordUvoginChallenge":              94,
	"geoStalkingMetaChallenge":                  95,
	"geoStalkingVisualChallenge":                96,
	"killChatbotChallenge":                      97,
	"nullByteChallenge":                         98,
	"bullyChatbotChallenge":                     99,
	"lfrChallenge":                              100,
}

func StartBackgroundSync(clientset *kubernetes.Clientset, workerCount int) {
	log.Infof("Starting ProgressWatchdog with %d worker go routines", workerCount)

	progressUpdateJobs := make(chan ProgressUpdateJobs)

	// Start 10 workers which fetch and update ContinueCodes based on the `progressUpdateJobs` queue / channel
	for i := 0; i < workerCount; i++ {
		go workOnProgressUpdates(progressUpdateJobs, clientset)
	}

	go createProgressUpdateJobs(progressUpdateJobs, clientset)
}

// Constantly lists all JuiceShops in managed by MultiJuicer and queues progressUpdatesJobs for them
func createProgressUpdateJobs(progressUpdateJobs chan<- ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for {
		// Get Instances
		log.Info("Looking for Instances")
		opts := metav1.ListOptions{
			LabelSelector: "app=juice-shop",
		}

		namespace := os.Getenv("NAMESPACE")
		juiceShops, err := clientset.AppsV1().Deployments(namespace).List(context.TODO(), opts)
		if err != nil {
			panic(err.Error())
		}

		log.Debugf("Found %d JuiceShop instances running", len(juiceShops.Items))

		for _, instance := range juiceShops.Items {
			teamname := instance.Labels["team"]

			if instance.Status.ReadyReplicas != 1 {
				continue
			}

			log.Debugf("Found instance for team %s", teamname)

			var lastChallengeProgress []ChallengeStatus
			json.Unmarshal([]byte(instance.Annotations["wrongsecrets-ctf-party.iteratec.dev/challenges"]), &lastChallengeProgress)

			progressUpdateJobs <- ProgressUpdateJobs{
				Teamname:              instance.Labels["team"],
				LastChallengeProgress: lastChallengeProgress,
			}
		}
		time.Sleep(60 * time.Second)
	}
}

func workOnProgressUpdates(progressUpdateJobs <-chan ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for job := range progressUpdateJobs {
		log.Debugf("Running ProgressUpdateJob for team '%s'", job.Teamname)
		lastChallengeProgress := job.LastChallengeProgress
		log.Debug("Fetching current Challenge Progress from JuiceShop")
		challengeProgress, err := getCurrentChallengeProgress(job.Teamname)

		if err != nil {
			log.Warningf("Failed to fetch current Challenge Progress for team '%s' from Juice Shop", job.Teamname)
			log.Warning(err)
			continue
		}

		log.Debug("Checking Difference between old and new Challenge Progresses")

		switch CompareChallengeStates(challengeProgress, lastChallengeProgress) {
		case ApplyCode:
			log.Infof("Last ContinueCode for team '%s' contains unsolved challenges", job.Teamname)
			applyChallengeProgress(job.Teamname, lastChallengeProgress)

			log.Debug("Re-fetching current Progress")
			challengeProgress, err = getCurrentChallengeProgress(job.Teamname)

			if err != nil {
				log.Errorf("Failed to re-fetch challenge progress from Juice Shop for team '%s' to reapply it", job.Teamname)
				log.Error(err)
				continue
			}

			log.Debug("Persisting current Challenge Progress")
			PersistProgress(clientset, job.Teamname, challengeProgress)
		case UpdateCache:
			PersistProgress(clientset, job.Teamname, challengeProgress)
		case NoOp:
			log.Debug("No need to apply Progress, Skipping")
		}
	}
}

func getCurrentChallengeProgress(teamname string) ([]ChallengeStatus, error) {
	url := fmt.Sprintf("http://t-%s-juiceshop:3000/api/challenges", teamname)

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		panic("Failed to create http request")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, errors.New("Failed to fetch Challenge Status")
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case 200:
		if err != nil {
			return nil, errors.New("Failed to response body stream from Juice Shop")
		}

		defer res.Body.Close()

		challengeResponse := ChallengeResponse{}

		err = json.NewDecoder(res.Body).Decode(&challengeResponse)
		if err != nil {
			return nil, errors.New("Failed to parse JSON from Juice Shop Challenge Status response")
		}

		challengeStatus := make(ChallengeStatuses, 0)

		for _, challenge := range challengeResponse.Data {
			if challenge.Solved == true {
				log.Debugf("Challenge %s: Solved: %t", challenge.Key, challenge.Solved)
				challengeStatus = append(challengeStatus, ChallengeStatus{
					Key:      challenge.Key,
					SolvedAt: challenge.UpdatedAt,
				})
			}
		}

		sort.Stable(challengeStatus)

		return challengeStatus, nil
	default:
		return nil, fmt.Errorf("Unexpected response status code '%d' from Juice Shop", res.StatusCode)
	}
}

func applyChallengeProgress(teamname string, challengeProgress []ChallengeStatus) {
	continueCode, err := GenerateContinueCode(challengeProgress)
	if err != nil {
		log.Warning("Failed to encode challenge progress into continue code")
		log.Warning(err)
		return
	}

	url := fmt.Sprintf("http://t-%s-juiceshop:3000/rest/continue-code/apply/%s", teamname, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request to set the current ContinueCode")
		log.Warning(err)
		return
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to set the current ContinueCode to juice shop")
		log.Warning(err)
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
