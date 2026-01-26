package adminmessage

import (
	"context"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

const ConfigMapName = "multi-juicer-admin-message"

func StartWatcher(
	ctx context.Context,
	b *bundle.Bundle,
	service *Service,
) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			watchOnce(ctx, b, service)
		}
	}
}

func watchOnce(
	ctx context.Context,
	b *bundle.Bundle,
	service *Service,
) {
	watcher, err := b.ClientSet.CoreV1().
		ConfigMaps(b.RuntimeEnvironment.Namespace).
		Watch(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=" + ConfigMapName,
		})
	if err != nil {
		b.Log.Printf("admin message watcher error: %v", err)
		time.Sleep(2 * time.Second)
		return
	}

	defer watcher.Stop()
	for {
		select {
		case ev, ok := <-watcher.ResultChan():
			if !ok {
				return
			}
			if ev.Type != watch.Added && ev.Type != watch.Modified {
				continue
			}

			cm := ev.Object.(*v1.ConfigMap)

			ts, _ := time.Parse(
				time.RFC3339,
				cm.Data["updatedAt"],
			)

			service.Set(&Message{
				Text:      cm.Data["text"],
				UpdatedAt: ts,
			})

		case <-ctx.Done():
			return
		}
	}
}
