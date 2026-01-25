package adminmessage

import (
	"context"
	"testing"
	"time"
)

func TestServiceSetAndGet(t *testing.T) {
	svc := NewService()

	now := time.Now().UTC()
	msg := &Message{
		Text:      "Body",
		UpdatedAt: now,
	}

	svc.Set(msg)

	got, ts := svc.Get()

	if got == nil {
		t.Fatalf("expected message, got nil")
	}
	if got.Text != msg.Text {
		t.Fatalf("messaeg doesn't match")
	}
	if ts != now {
		t.Fatalf("timestamp mismatch")
	}

}

func TestWaitForUpdatesImmediate(t *testing.T) {
	svc := NewService()

	now := time.Now().UTC()
	svc.Set(&Message{
		Text:      "Hello",
		UpdatedAt: now,
	})

	msg, ts, ok := svc.WaitForUpdatesNewerThan(
		context.Background(),
		time.Time{},
	)

	if !ok {
		t.Fatalf("expected update")
	}
	if msg.Text != "Hello" {
		t.Fatalf("wrong message")
	}
	if ts != now {
		t.Fatalf("wrong timestamp")
	}
}

func TestWaitForUpdatesBlocksThenUnblocks(t *testing.T) {
	svc := NewService()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	done := make(chan struct{})

	go func() {
		msg, _, ok := svc.WaitForUpdatesNewerThan(
			ctx,
			time.Now(),
		)

		if !ok || msg == nil {
			t.Errorf("wait failed")
		}
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	svc.Set(&Message{
		Text:      "New",
		UpdatedAt: time.Now().UTC(),
	})

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("wait did not unblock")
	}
}

func TestWaitForUpdatesContextCancel(t *testing.T) {
	svc := NewService()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	msg, ts, ok := svc.WaitForUpdatesNewerThan(
		ctx,
		time.Now(),
	)

	if ok {
		t.Fatalf("expected no update")
	}
	if msg != nil || !ts.IsZero() {
		t.Fatalf("unexpected data")
	}
}
