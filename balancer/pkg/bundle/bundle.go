package bundle

import (
	"log"

	"k8s.io/client-go/kubernetes"
)

type Bundle struct {
	RuntimeEnvironment RuntimeEnvironment
	ClientSet          kubernetes.Interface
	Config             *Config
	Log                *log.Logger
}

type RuntimeEnvironment struct {
	Namespace string `json:"namespace"`
}

type Config struct {
	JuiceShopImage                    string
	JuiceShopTag                      string
	JuiceShopNodeEnv                  string
	JuiceShopCtfKey                   string
	JuiceShopImagePullPolicy          string
	JuiceShopResources                map[string]string // Could be customized based on actual use
	JuiceShopPodSecurityContext       map[string]string // Could be customized based on actual use
	JuiceShopContainerSecurityContext map[string]string // Could be customized based on actual use
	JuiceShopEnvFrom                  []string
	JuiceShopVolumeMounts             []string
	JuiceShopVolumes                  []string
	JuiceShopTolerations              []string
	JuiceShopAffinity                 string
	DeploymentContext                 string
	CookieConfig                      CookieConfig `json:"cookie"`
}

type CookieConfig struct {
	// CookieSigningKey is used to create a hmac signature of the team name to have  readable but cryptographically secure cookie name to identify the team
	SigningKey string `json:"signingKey"`
}
