package notifications

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestAddAndGetCurrent(t *testing.T) {
	svc := NewService()
	now := time.Now()

	n1 := Notification{
		Team:      "team-a",
		Title:     "Hello",
		Message:   "World",
		Level:     "info",
		CreatedAt: now,
	}

	n2 := Notification{
		Team:      "",
		Title:     "Global",
		Message:   "Notice",
		Level:     "warning",
		CreatedAt: now.Add(time.Second),
	}

	svc.Add(n1)
	svc.Add(n2)

	data, last := svc.GetCurrent("team-a")

	if len(data) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(data))
	}

	if !last.Equal(n2.CreatedAt) {
		t.Fatalf("expected lastUpdate %v, got %v", n2.CreatedAt, last)
	}
}

func TestWaitForUpdatesImmediateReturn(t *testing.T) {
	svc := NewService()
	now := time.Now()

	svc.Add(Notification{
		Team:      "team-a",
		Title:     "Immediate",
		Message:   "Hit",
		Level:     "info",
		CreatedAt: now,
	})

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	data, last, ok := svc.WaitForUpdatesNewerThan(ctx, now.Add(-time.Second), "team-a")

	if !ok {
		t.Fatal("expected update, got none")
	}

	if len(data) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(data))
	}

	if !last.Equal(now) {
		t.Fatalf("unexpected lastUpdate: %v", last)
	}
}

func TestWaitForUpdatesBlocksUntilAdd(t *testing.T) {
	svc := NewService()
	start := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var (
		data []Notification
		ok   bool
	)

	done := make(chan struct{})

	go func() {
		data, _, ok = svc.WaitForUpdatesNewerThan(ctx, start, "team-a")
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)

	svc.Add(Notification{
		Team:      "team-a",
		Title:     "Wake up",
		Message:   "Now",
		Level:     "info",
		CreatedAt: time.Now(),
	})

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("waiter did not wake up")
	}

	if !ok {
		t.Fatal("expected ok=true after add")
	}

	if len(data) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(data))
	}
}

func TestWaitForUpdatesContextCancel(t *testing.T) {
	svc := NewService()
	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})

	go func() {
		data, _, ok := svc.WaitForUpdatesNewerThan(ctx, time.Now(), "team-a")
		if ok || data != nil {
			t.Error("expected no data on context cancel")
		}
		close(done)
	}()

	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("waiter did not exit on context cancel")
	}
}

func TestWaitForUpdatesMultipleWaiters(t *testing.T) {
	svc := NewService()
	ctx := context.Background()

	var wg sync.WaitGroup
	waiters := 5
	wg.Add(waiters)

	for range waiters {
		go func() {
			defer wg.Done()
			_, _, ok := svc.WaitForUpdatesNewerThan(ctx, time.Now(), "")
			if !ok {
				t.Error("expected update")
			}
		}()
	}

	time.Sleep(50 * time.Millisecond)

	svc.Add(Notification{
		Title:     "Broadcast",
		Message:   "All",
		Level:     "info",
		CreatedAt: time.Now(),
	})

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("not all waiters were woken")
	}
}

func TestFilterByTeam(t *testing.T) {
	all := []Notification{
		{Team: "team-a"},
		{Team: "team-b"},
		{Team: ""},
	}

	outa := filterByTeam(all, "team-a")

	if len(outa) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(outa))
	}

	outall := filterByTeam(all, "")

	if len(outall) != 3 {
		t.Fatalf("expected 3 notifications, got %d", len(outall))
	}
}
