package adminmessage

import (
	"context"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes/fake"
	testcore "k8s.io/client-go/testing"
)

func TestWatcherUpdatesService(t *testing.T) {
	clientset := fake.NewSimpleClientset()
	b := testutil.NewTestBundleWithCustomFakeClient(clientset)

	svc := NewService()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go StartWatcher(ctx, b, svc)

	watcher := watch.NewFake()
	clientset.PrependWatchReactor("configmaps", testcore.DefaultWatchReactor(watcher, nil))

	now := time.Now().UTC()

	cm := &v1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name: ConfigMapName,
		},
		Data: map[string]string{
			"text":      "Hello",
			"updatedAt": now.Format(time.RFC3339),
		},
	}

	watcher.Add(cm)

	assert.Eventually(t, func() bool {
		msg, _ := svc.Get()
		return msg != nil && msg.Text == "Hello"
	}, time.Second, 10*time.Millisecond)
}
