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

	"github.com/speps/go-hashids/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

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

// can be generated / update using: curl https://demo.owasp-juice.shop/api/challenges | jq '.data | map({ key: .key, value: .id }) | from_entries'
var challengeIdLookup = map[string]int{
	"restfulXssChallenge":                       1,
	"accessLogDisclosureChallenge":              2,
	"registerAdminChallenge":                    3,
	"adminSectionChallenge":                     4,
	"fileWriteChallenge":                        5,
	"resetPasswordBjoernOwaspChallenge":         6,
	"tokenSaleChallenge":                        7,
	"nftUnlockChallenge":                        8,
	"nftMintChallenge":                          9,
	"web3WalletChallenge":                       10,
	"web3SandboxChallenge":                      11,
	"rceChallenge":                              12,
	"captchaBypassChallenge":                    13,
	"changePasswordBenderChallenge":             14,
	"christmasSpecialChallenge":                 15,
	"usernameXssChallenge":                      16,
	"persistedXssUserChallenge":                 17,
	"directoryListingChallenge":                 18,
	"localXssChallenge":                         19,
	"dbSchemaChallenge":                         20,
	"deprecatedInterfaceChallenge":              21,
	"easterEggLevelOneChallenge":                22,
	"emailLeakChallenge":                        23,
	"emptyUserRegistration":                     24,
	"ephemeralAccountantChallenge":              25,
	"errorHandlingChallenge":                    26,
	"manipulateClockChallenge":                  27,
	"extraLanguageChallenge":                    28,
	"feedbackChallenge":                         29,
	"forgedCouponChallenge":                     30,
	"forgedFeedbackChallenge":                   31,
	"forgedReviewChallenge":                     32,
	"jwtForgedChallenge":                        33,
	"forgottenDevBackupChallenge":               34,
	"forgottenBackupChallenge":                  35,
	"typosquattingAngularChallenge":             36,
	"ghostLoginChallenge":                       37,
	"dataExportChallenge":                       38,
	"httpHeaderXssChallenge":                    39,
	"continueCodeChallenge":                     40,
	"dlpPasswordSprayingChallenge":              41,
	"dlpPastebinDataLeakChallenge":              42,
	"typosquattingNpmChallenge":                 43,
	"loginAdminChallenge":                       44,
	"loginAmyChallenge":                         45,
	"loginBenderChallenge":                      46,
	"oauthUserPasswordChallenge":                47,
	"loginJimChallenge":                         48,
	"loginRapperChallenge":                      49,
	"loginSupportChallenge":                     50,
	"basketManipulateChallenge":                 51,
	"misplacedSignatureFileChallenge":           52,
	"timingAttackChallenge":                     53,
	"easterEggLevelTwoChallenge":                54,
	"noSqlCommandChallenge":                     55,
	"noSqlOrdersChallenge":                      56,
	"noSqlReviewsChallenge":                     57,
	"redirectCryptoCurrencyChallenge":           58,
	"weakPasswordChallenge":                     59,
	"negativeOrderChallenge":                    60,
	"premiumPaywallChallenge":                   61,
	"privacyPolicyChallenge":                    62,
	"privacyPolicyProofChallenge":               63,
	"changeProductChallenge":                    64,
	"reflectedXssChallenge":                     65,
	"passwordRepeatChallenge":                   66,
	"resetPasswordBenderChallenge":              67,
	"resetPasswordBjoernChallenge":              68,
	"resetPasswordJimChallenge":                 69,
	"resetPasswordMortyChallenge":               70,
	"retrieveBlueprintChallenge":                71,
	"ssrfChallenge":                             72,
	"sstiChallenge":                             73,
	"scoreBoardChallenge":                       74,
	"securityPolicyChallenge":                   75,
	"persistedXssFeedbackChallenge":             76,
	"hiddenImageChallenge":                      77,
	"rceOccupyChallenge":                        78,
	"supplyChainAttackChallenge":                79,
	"twoFactorAuthUnsafeSecretStorageChallenge": 80,
	"jwtUnsignedChallenge":                      81,
	"uploadSizeChallenge":                       82,
	"uploadTypeChallenge":                       83,
	"unionSqlInjectionChallenge":                84,
	"videoXssChallenge":                         85,
	"basketAccessChallenge":                     86,
	"knownVulnerableComponentChallenge":         87,
	"weirdCryptoChallenge":                      88,
	"redirectChallenge":                         89,
	"xxeFileDisclosureChallenge":                90,
	"xxeDosChallenge":                           91,
	"zeroStarsChallenge":                        92,
	"missingEncodingChallenge":                  93,
	"svgInjectionChallenge":                     94,
	"exposedMetricsChallenge":                   95,
	"freeDeluxeChallenge":                       96,
	"csrfChallenge":                             97,
	"xssBonusChallenge":                         98,
	"resetPasswordUvoginChallenge":              99,
	"geoStalkingMetaChallenge":                  100,
	"geoStalkingVisualChallenge":                101,
	"killChatbotChallenge":                      102,
	"nullByteChallenge":                         103,
	"bullyChatbotChallenge":                     104,
	"lfrChallenge":                              105,
	"closeNotificationsChallenge":               106,
	"csafChallenge":                             107,
}

func StartBackgroundSync(clientset *kubernetes.Clientset, workerCount int) {
	logger.Printf("Starting background-sync looking for JuiceShop challenge progress changes with %d workers", workerCount)

	progressUpdateJobs := make(chan ProgressUpdateJobs)

	// Start 10 workers which fetch and update ContinueCodes based on the `progressUpdateJobs` queue / channel
	for i := 0; i < workerCount; i++ {
		go workOnProgressUpdates(progressUpdateJobs, clientset)
	}

	go createProgressUpdateJobs(progressUpdateJobs, clientset)
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
			panic(err.Error())
		}

		logger.Printf("Background-sync started syncing %d instances", len(juiceShops.Items))

		for _, instance := range juiceShops.Items {
			Team := instance.Labels["team"]

			if instance.Status.ReadyReplicas != 1 {
				continue
			}

			var lastChallengeProgress []ChallengeStatus
			json.Unmarshal([]byte(instance.Annotations["multi-juicer.owasp-juice.shop/challenges"]), &lastChallengeProgress)

			progressUpdateJobs <- ProgressUpdateJobs{
				Team:                  Team,
				LastChallengeProgress: lastChallengeProgress,
			}
		}
		time.Sleep(60 * time.Second)
	}
}

func workOnProgressUpdates(progressUpdateJobs <-chan ProgressUpdateJobs, clientset *kubernetes.Clientset) {
	for job := range progressUpdateJobs {
		lastChallengeProgress := job.LastChallengeProgress
		challengeProgress, err := getCurrentChallengeProgress(job.Team)

		if err != nil {
			logger.Println(fmt.Errorf("failed to fetch current Challenge Progress for team '%s' from Juice Shop: %w", job.Team, err))
			continue
		}

		switch CompareChallengeStates(challengeProgress, lastChallengeProgress) {
		case ApplyCode:
			logger.Printf("Last ContinueCode for team '%s' contains unsolved challenges", job.Team)
			applyChallengeProgress(job.Team, lastChallengeProgress)

			challengeProgress, err = getCurrentChallengeProgress(job.Team)

			if err != nil {
				logger.Println(fmt.Errorf("failed to re-fetch challenge progress from Juice Shop for team '%s' to reapply it: %w", job.Team, err))
				continue
			}
			PersistProgress(clientset, job.Team, challengeProgress)
		case UpdateCache:
			PersistProgress(clientset, job.Team, challengeProgress)
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
		defer res.Body.Close()

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

func applyChallengeProgress(team string, challengeProgress []ChallengeStatus) {
	continueCode, err := GenerateContinueCode(challengeProgress)
	if err != nil {
		logger.Println(fmt.Errorf("failed to encode challenge progress into continue code: %w", err))
		return
	}

	url := fmt.Sprintf("http://juiceshop-%s:3000/rest/continue-code/apply/%s", team, continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		logger.Println(fmt.Errorf("failed to create http request to set the current ContinueCode: %w", err))
		return
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		logger.Println(fmt.Errorf("failed to set the current ContinueCode to juice shop: %w", err))
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
