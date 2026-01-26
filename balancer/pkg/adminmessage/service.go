package adminmessage

import (
	"context"
	"sync"
	"time"
)

type Service struct {
	mu         sync.Mutex
	current    *Message
	lastUpdate time.Time
	waiters    []chan struct{}
}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Set(msg *Message) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if msg.UpdatedAt.IsZero() {
		msg.UpdatedAt = time.Now().UTC()
	}

	s.current = msg
	s.lastUpdate = msg.UpdatedAt

	for _, ch := range s.waiters {
		close(ch)
	}
	s.waiters = nil
}

func (s *Service) Get() (*Message, time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.current, s.lastUpdate
}

func (s *Service) WaitForUpdatesNewerThan(
	ctx context.Context,
	after time.Time,
) (*Message, time.Time, bool) {
	s.mu.Lock()
	if s.lastUpdate.After(after) {
		msg := s.current
		ts := s.lastUpdate
		s.mu.Unlock()
		return msg, ts, msg != nil
	}

	const maxWaitTime = 25 * time.Second
	timeout := time.NewTimer(maxWaitTime)
	defer timeout.Stop()

	ch := make(chan struct{})
	s.waiters = append(s.waiters, ch)
	s.mu.Unlock()

	select {
	case <-ctx.Done():
		return nil, time.Time{}, false
	case <-timeout.C:
		return nil, time.Time{}, false
	case <-ch:
		s.mu.Lock()
		defer s.mu.Unlock()
		return s.current, s.lastUpdate, s.current != nil
	}
}
