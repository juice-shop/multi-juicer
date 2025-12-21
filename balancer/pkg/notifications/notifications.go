package notifications

import (
	"context"
	"sync"
	"time"
)

type Notification struct {
	Team      string    `json:"team"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Level     string    `json:"level"`
	CreatedAt time.Time `json:"createdAt"`
}

type Service struct {
	mu            sync.Mutex
	notifications []Notification
	lastUpdate    time.Time
	waiters       []chan struct{}
}

func NewService() *Service {
	return &Service{}
}

func (s *Service) Add(n Notification) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.notifications = append(s.notifications, n)
	s.lastUpdate = n.CreatedAt

	for _, ch := range s.waiters {
		close(ch)
	}
	s.waiters = nil
}
func (s *Service) GetCurrent(team string) ([]Notification, time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()

	return filterByTeam(s.notifications, team), s.lastUpdate
}

func (s *Service) WaitForUpdatesNewerThan(
	ctx context.Context,
	after time.Time,
	team string,
) ([]Notification, time.Time, bool) {

	s.mu.Lock()
	if s.lastUpdate.After(after) {
		data := filterByTeam(s.notifications, team)
		last := s.lastUpdate
		s.mu.Unlock()
		return data, last, true
	}

	const maxWaitTime = 10 * time.Second
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
		return filterByTeam(s.notifications, team), s.lastUpdate, true
	}
}

func filterByTeam(all []Notification, team string) []Notification {
	if team == "" {
		return all
	}

	out := make([]Notification, 0)
	for _, n := range all {
		if n.Team == "" || n.Team == team {
			out = append(out, n)
		}
	}
	return out
}
