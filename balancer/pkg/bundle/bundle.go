package bundle

import (
	"errors"
	"log"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/passcode"
	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type Bundle struct {
	RuntimeEnvironment    RuntimeEnvironment
	ClientSet             kubernetes.Interface
	PasscodeGenerator     func() string
	BcryptRounds          int
	StaticAssetsDirectory string `json:"staticAssetsDirectory"`
	Config                *Config
	Log                   *log.Logger
}

type RuntimeEnvironment struct {
	Namespace string `json:"namespace"`
}

type Config struct {
	JuiceShopConfig JuiceShopConfig `json:"juiceShop"`
	CookieConfig    CookieConfig    `json:"cookie"`
}

type CookieConfig struct {
	// CookieSigningKey is used to create a hmac signature of the team name to have  readable but cryptographically secure cookie name to identify the team
	SigningKey string `json:"signingKey"`
}

type JuiceShopConfig struct {
	Image           string            `json:"image"`
	Tag             string            `json:"tag"`
	ImagePullPolicy corev1.PullPolicy `json:"imagePullPolicy"`
	CtfKey          string            `json:"ctfKey"`
	NodeEnv         string            `json:"nodeEnv"`

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
	Annotations              map[string]string           `json:"annotations"`
	Labels                   map[string]string           `json:"labels"`
}

func New() *Bundle {
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	clientset, err := kubernetes.NewForConfig(config)
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

	return &Bundle{
		ClientSet:             clientset,
		StaticAssetsDirectory: "/public/",
		RuntimeEnvironment: RuntimeEnvironment{
			Namespace: namespace,
		},
		PasscodeGenerator: passcode.GeneratePasscode,
		BcryptRounds:      bcrypt.DefaultCost,
		Log:               log.New(os.Stdout, "", log.LstdFlags),
		Config: &Config{
			JuiceShopConfig: JuiceShopConfig{
				ImagePullPolicy: "IfNotPresent",
				Image:           "bkimminich/juice-shop",
				Tag:             "latest",
				NodeEnv:         "multi-juicer",
				Resources: corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse("200m"),
						corev1.ResourceMemory: resource.MustParse("256Mi"),
					},
					Limits: corev1.ResourceList{
						corev1.ResourceCPU:    resource.MustParse("200m"),
						corev1.ResourceMemory: resource.MustParse("256Mi"),
					},
				},
			},
			CookieConfig: CookieConfig{
				SigningKey: cookieSigningKey,
			},
		},
	}
}
