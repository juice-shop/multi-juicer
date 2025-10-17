package e2e

import (
"bytes"
"encoding/json"
"fmt"
"net/http"
"net/http/cookiejar"
"time"
)

type TestClient struct {
	httpClient *http.Client
	baseURL    string
	teamCookie *http.Cookie
}

type ActivityEvent struct {
	Team          string    `json:"team"`
	ChallengeKey  string    `json:"challengeKey"`
	ChallengeName string    `json:"challengeName"`
	Points        int       `json:"points"`
	SolvedAt      time.Time `json:"solvedAt"`
	IsFirstSolve  bool      `json:"IsFirstSolve"`
}

func NewTestClient(baseURL string) *TestClient {
	jar, _ := cookiejar.New(nil)
	return &TestClient{
		httpClient: &http.Client{
			Jar:     jar,
			Timeout: 30 * time.Second,
		},
		baseURL: baseURL,
	}
}

func (tc *TestClient) JoinTeam(teamName string) error {
	resp, err := tc.httpClient.Post(
fmt.Sprintf("%s/balancer/api/teams/%s/join", tc.baseURL, teamName),
"application/json",
nil,
)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to join team: status %d", resp.StatusCode)
	}

	// Store team cookie
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "team" {
			tc.teamCookie = cookie
			break
		}
	}

	return nil
}

func (tc *TestClient) GetActivityFeed() ([]ActivityEvent, error) {
	resp, err := tc.httpClient.Get(fmt.Sprintf("%s/balancer/api/activity-feed", tc.baseURL))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var events []ActivityEvent
	if err := json.NewDecoder(resp.Body).Decode(&events); err != nil {
		return nil, err
	}

	return events, nil
}

func (tc *TestClient) GetScoreboard() (map[string]interface{}, error) {
	resp, err := tc.httpClient.Get(fmt.Sprintf("%s/balancer/api/scoreboard", tc.baseURL))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var scoreboard map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&scoreboard); err != nil {
		return nil, err
	}

	return scoreboard, nil
}

func (tc *TestClient) SolveChallenge(challengeKey string, solution interface{}) error {
	payload, err := json.Marshal(map[string]interface{}{
"key":      challengeKey,
"solution": solution,
})
	if err != nil {
		return err
	}

	req, err := http.NewRequest(
"POST",
fmt.Sprintf("%s/api/Challenges/%s", tc.baseURL, challengeKey),
bytes.NewBuffer(payload),
)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	if tc.teamCookie != nil {
		req.AddCookie(tc.teamCookie)
	}

	resp, err := tc.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to solve challenge: status %d", resp.StatusCode)
	}

	return nil
}

func (tc *TestClient) GetTeamStatus(teamName string) (map[string]interface{}, error) {
	resp, err := tc.httpClient.Get(fmt.Sprintf("%s/balancer/api/teams/%s/status", tc.baseURL, teamName))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var status map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}

	return status, nil
}
