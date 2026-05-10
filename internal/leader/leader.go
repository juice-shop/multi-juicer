package leader

import (
	"context"
	"log/slog"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"
)

const leaseName = "multi-juicer-leader"

// Run blocks acquiring/holding the multi-juicer leader lease. onStartedLeading runs in a goroutine
// once leadership is acquired; the ctx it receives is cancelled the moment leadership is lost so
// background workers can shut down cleanly.
func Run(ctx context.Context, log *slog.Logger, clientset kubernetes.Interface, namespace, identity string, onStartedLeading func(context.Context)) {
	lock := &resourcelock.LeaseLock{
		LeaseMeta: metav1.ObjectMeta{
			Name:      leaseName,
			Namespace: namespace,
		},
		Client: clientset.CoordinationV1(),
		LockConfig: resourcelock.ResourceLockConfig{
			Identity: identity,
		},
	}

	leaderelection.RunOrDie(ctx, leaderelection.LeaderElectionConfig{
		Lock:            lock,
		ReleaseOnCancel: true,
		LeaseDuration:   30 * time.Second,
		RenewDeadline:   20 * time.Second,
		RetryPeriod:     5 * time.Second,
		Callbacks: leaderelection.LeaderCallbacks{
			OnStartedLeading: func(leaderCtx context.Context) {
				log.Info("Acquired leader lease", "identity", identity)
				onStartedLeading(leaderCtx)
			},
			OnStoppedLeading: func() {
				log.Info("Lost leader lease", "identity", identity)
			},
			OnNewLeader: func(current string) {
				if current != identity {
					log.Info("Observed leader change", "leader", current)
				}
			},
		},
	})
}
