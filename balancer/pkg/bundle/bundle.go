package bundle

import "k8s.io/client-go/kubernetes"

type Bundle struct {
	RuntimeEnvironment RuntimeEnvironment
	ClientSet          kubernetes.Interface
	Config             *Config
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
}
