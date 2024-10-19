package testutil

import (
	"log"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
)

func NewTestBundle() *bundle.Bundle {
	clientset := fake.NewSimpleClientset()
	return NewTestBundleWithCustomFakeClient(clientset)
}

var testSigningKey = "test-signing-key"

func NewTestBundleWithCustomFakeClient(clientset kubernetes.Interface) *bundle.Bundle {
	return &bundle.Bundle{
		ClientSet:             clientset,
		StaticAssetsDirectory: "../ui/build/",
		RuntimeEnvironment: bundle.RuntimeEnvironment{
			Namespace: "test-namespace",
		},
		GeneratePasscode: func() string {
			return "12345678"
		},
		BcryptRounds: 2,
		Log:          log.New(os.Stdout, "", log.LstdFlags),
		Config: &bundle.Config{
			JuiceShopConfig: bundle.JuiceShopConfig{
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
			CookieConfig: bundle.CookieConfig{
				SigningKey: testSigningKey,
			},
		},
	}
}

func SignTestTeamname(team string) string {
	signed, err := signutil.Sign(team, testSigningKey)
	if err != nil {
		panic(err)
	}
	return signed
}
