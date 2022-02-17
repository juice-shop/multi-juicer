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

	"github.com/speps/go-hashids"
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
	"loginCisoChallenge":                        43,
	"loginJimChallenge":                         44,
	"loginRapperChallenge":                      45,
	"loginSupportChallenge":                     46,
	"basketManipulateChallenge":                 47,
	"misplacedSignatureFileChallenge":           48,
	"timingAttackChallenge":                     49,
	"easterEggLevelTwoChallenge":                50,
	"noSqlCommandChallenge":                     51,
	"noSqlOrdersChallenge":                      52,
	"noSqlReviewsChallenge":                     53,
	"redirectCryptoCurrencyChallenge":           54,
	"weakPasswordChallenge":                     55,
	"negativeOrderChallenge":                    56,
	"premiumPaywallChallenge":                   57,
	"privacyPolicyChallenge":                    58,
	"privacyPolicyProofChallenge":               59,
	"changeProductChallenge":                    60,
	"reflectedXssChallenge":                     61,
	"passwordRepeatChallenge":                   62,
	"resetPasswordBenderChallenge":              63,
	"resetPasswordBjoernChallenge":              64,
	"resetPasswordJimChallenge":                 65,
	"resetPasswordMortyChallenge":               66,
	"retrieveBlueprintChallenge":                67,
	"ssrfChallenge":                             68,
	"sstiChallenge":                             69,
	"scoreBoardChallenge":                       70,
	"securityPolicyChallenge":                   71,
	"persistedXssFeedbackChallenge":             72,
	"hiddenImageChallenge":                      73,
	"rceOccupyChallenge":                        74,
	"supplyChainAttackChallenge":                75,
	"twoFactorAuthUnsafeSecretStorageChallenge": 76,
	"jwtUnsignedChallenge":                      77,
	"uploadSizeChallenge":                       78,
	"uploadTypeChallenge":                       79,
	"unionSqlInjectionChallenge":                80,
	"videoXssChallenge":                         81,
	"basketAccessChallenge":                     82,
	"knownVulnerableComponentChallenge":         83,
	"weirdCryptoChallenge":                      84,
	"redirectChallenge":                         85,
	"xxeFileDisclosureChallenge":                86,
	"xxeDosChallenge":                           87,
	"zeroStarsChallenge":                        88,
	"missingEncodingChallenge":                  89,
	"svgInjectionChallenge":                     90,
	"exposedMetricsChallenge":                   91,
	"freeDeluxeChallenge":                       92,
	"csrfChallenge":                             93,
	"xssBonusChallenge":                         94,
	"resetPasswordUvoginChallenge":              95,
	"geoStalkingMetaChallenge":                  96,
	"geoStalkingVisualChallenge":                97,
	"killChatbotChallenge":                      98,
	"nullByteChallenge":                         99,
	"bullyChatbotChallenge":                     100,
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
			json.Unmarshal([]byte(instance.Annotations["multi-juicer.iteratec.dev/challenges"]), &lastChallengeProgress)

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
