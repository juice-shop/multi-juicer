package bundle

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/passcode"
	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// Bundle holds all the dependencies and configurationthat are used by the routes
// for testing it can be mocked out, see testutil/testUtils.go for helper functions to easily mock out the bundle
type Bundle struct {
	RuntimeEnvironment RuntimeEnvironment
	ClientSet          kubernetes.Interface
	// generates a random passcode. On the bundle to have a static passcode in tests for easier assertions
	GeneratePasscode func() string
	// returns the (cluster internal) url for a team used by the balancer to proxy the request to. On the bundle to allow the tests to proxy requests to a local testing server
	GetJuiceShopUrlForTeam func(team string, bundle *Bundle) string
	BcryptRounds           int
	StaticAssetsDirectory  string `json:"staticAssetsDirectory"`
	Config                 *Config
	Log                    *log.Logger

	JuiceShopChallenges []JuiceShopChallenge
}

type RuntimeEnvironment struct {
	Namespace string `json:"namespace"`
}

type Config struct {
	JuiceShopConfig JuiceShopConfig `json:"juiceShop"`
	MaxInstances    int             `json:"maxInstances"`
	CookieConfig    CookieConfig    `json:"cookie"`
	AdminConfig     *AdminConfig
}

type AdminConfig struct {
	Password string `json:"password"`
}

type CookieConfig struct {
	// CookieSigningKey is used to create a hmac signature of the team name to have  readable but cryptographically secure cookie name to identify the team
	SigningKey string `json:"signingKey"`

	// CookieName is the name of the cookie that is used to store the team name
	Name string `json:"name"`

	// Secure controls if the Secure attribute is set on the cookie.
	Secure bool `json:"secure"`
}

type JuiceShopConfig struct {
	Image            string                        `json:"image"`
	Tag              string                        `json:"tag"`
	ImagePullPolicy  corev1.PullPolicy             `json:"imagePullPolicy"`
	ImagePullSecrets []corev1.LocalObjectReference `json:"imagePullSecrets"`
	CtfKey           string                        `json:"ctfKey"`
	NodeEnv          string                        `json:"nodeEnv"`

	PodSecurityContext       corev1.PodSecurityContext   `json:"podSecurityContext"`
	ContainerSecurityContext corev1.SecurityContext      `json:"containerSecurityContext"`
	Resources                corev1.ResourceRequirements `json:"resources"`
	Tolerations              []corev1.Toleration         `json:"tolerations"`
	Affinity                 corev1.Affinity             `json:"affinity"`
	Env                      []corev1.EnvVar             `json:"env"`
	EnvFrom                  []corev1.EnvFromSource      `json:"envFrom"`
	Volumes                  []corev1.Volume             `json:"volumes"`
	VolumeMounts             []corev1.VolumeMount        `json:"volumeMounts"`
	RuntimeClassName         *string                     `json:"runtimeClassName"`

	JuiceShopPodConfig JuiceShopPodConfig `json:"pod"`
}

type JuiceShopPodConfig struct {
	Annotations map[string]string `json:"annotations"`
	Labels      map[string]string `json:"labels"`
}

// JuiceShopChallenge represents a challenge in the Juice Shop that can be solved by the participants
type JuiceShopChallenge struct {
	Name          string   `json:"name"`
	Category      string   `json:"category"`
	Tags          []string `json:"tags"`
	Description   string   `json:"description"`
	Difficulty    int      `json:"difficulty"`
	Hint          string   `json:"hint"`
	HintUrl       string   `json:"hintUrl"`
	MitigationUrl string   `json:"mitigationUrl"`
	Key           string   `json:"key"`
	DisabledEnv   []string `json:"disabledEnv"`
}

func getJuiceShopUrlForTeam(team string, bundle *Bundle) string {
	return fmt.Sprintf("http://juiceshop-%s.%s.svc.cluster.local:3000", team, bundle.RuntimeEnvironment.Namespace)
}

func New() *Bundle {
	kubeClientConfig, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	clientset, err := kubernetes.NewForConfig(kubeClientConfig)
	if err != nil {
		panic(err.Error())
	}

	namespace := os.Getenv("NAMESPACE")
	if namespace == "" {
		panic(errors.New("environment variable 'NAMESPACE' must be set"))
	}

	cookieSigningKey := os.Getenv("MULTI_JUICER_CONFIG_COOKIE_SIGNING_KEY")
	if cookieSigningKey == "" {
		panic(errors.New("environment variable 'MULTI_JUICER_CONFIG_COOKIE_SIGNING_KEY' must be set"))
	}

	adminPasswordKey := os.Getenv("MULTI_JUICER_CONFIG_ADMIN_PASSWORD")
	if adminPasswordKey == "" {
		panic(errors.New("environment variable 'MULTI_JUICER_CONFIG_ADMIN_PASSWORD' must be set"))
	}

	config, err := readConfigFromFile("/config/config.json")
	if err != nil {
		panic(err)
	}

	config.CookieConfig.SigningKey = cookieSigningKey
	config.AdminConfig = &AdminConfig{Password: adminPasswordKey}

	// read /challenges.json file
	challengesBytes, err := os.ReadFile("/challenges.json")
	if err != nil {
		panic(err)
	}

	var challenges []JuiceShopChallenge
	err = json.Unmarshal(challengesBytes, &challenges)
	if err != nil {
		panic(err)
	}

	return &Bundle{
		ClientSet:             clientset,
		StaticAssetsDirectory: "/public/",
		RuntimeEnvironment: RuntimeEnvironment{
			Namespace: namespace,
		},
		GeneratePasscode:       passcode.GeneratePasscode,
		GetJuiceShopUrlForTeam: getJuiceShopUrlForTeam,
		BcryptRounds:           bcrypt.DefaultCost,
		Log:                    log.New(os.Stdout, "", log.LstdFlags),
		Config:                 config,
		JuiceShopChallenges:    challenges,
	}
}

func readConfigFromFile(filePath string) (*Config, error) {
	var config Config

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open config file: %w", err)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&config); err != nil {
		return nil, fmt.Errorf("failed to decode config file: %w", err)
	}

	return &config, err
}
