package bundle

import (
	"log"

	corev1 "k8s.io/api/core/v1"
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
