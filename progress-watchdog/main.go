package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"time"

	"github.com/go-redis/redis"
	"github.com/op/go-logging"
)

var log = logging.MustGetLogger("ProgressWatchdog")

// ChallengesPayload complete payload from the JuiceShop challenge api endpoint
type ChallengesPayload struct {
	Status string      `json:"status"`
	Data   []Challenge `json:"data"`
}

// Challenge JuiceShop Challenge model
type Challenge struct {
	ID          int    `json:"id"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Difficulty  int    `json:"difficulty"`
	Solved      bool   `json:"solved"`
}

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPassword := os.Getenv("REDIS_PASSWORD")

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password: redisPassword,
	})

	pong, err := client.Ping().Result()
	if err == nil {
		log.Infof("Got Redis Pong Back: %v", pong)
	} else {
		log.Error("Could not reach redis")
		log.Errorf("%v", err)
	}

	for {
		time.Sleep(5 * time.Second)

		totalChallenges := 0
		solvedChallenges := 0
		challenges := getChallengeStatus()

		if challenges == nil {
			log.Info("Failed to read challenge status")
			continue
		}

		for _, challenge := range challenges.Data {
			log.Debugf("Challenge '%s': %t", challenge.Key, challenge.Solved)
			totalChallenges++
			if challenge.Solved {
				solvedChallenges++
			}
		}

		log.Infof("%d/%d challenges solved", solvedChallenges, totalChallenges)
	}
}

func getChallengeStatus() *ChallengesPayload {
	url := "http://localhost:3000/api/Challenges/"

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request")
		log.Warning(err)
		return nil
	}
	client := http.DefaultClient
	res, err := client.Do(req)
	if err != nil {
		log.Warning("Failed to fetch progress from juice shop.")
		log.Warning(err)
		return nil
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case 200:
		body, err := ioutil.ReadAll(res.Body)

		if err != nil {
			log.Error("Failed to read response body stream.")
			return nil
		}

		challengesPayload := ChallengesPayload{}

		err = json.Unmarshal(body, &challengesPayload)

		if err != nil {
			log.Error("Failed to parse json of a challenge status.")
			log.Error(err)
			return nil
		}

		return &challengesPayload

	default:
		log.Warningf("Unexpected response status code '%d'", res.StatusCode)
		return nil
	}
}
