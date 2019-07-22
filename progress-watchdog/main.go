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

var format = logging.MustStringFormatter(
	`%{time:15:04:05.000} %{shortfunc}: %{level:.4s} %{message}`,
)

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

// ContinueCodePayload json format of the get continue code response
type ContinueCodePayload struct {
	ContinueCode string `json:"continueCode"`
}

func main() {
	logBackend := logging.NewLogBackend(os.Stdout, "", 0)

	logFormatter := logging.NewBackendFormatter(logBackend, format)
	logBackendLeveled := logging.AddModuleLevel(logBackend)
	logBackendLeveled.SetLevel(logging.ERROR, "")

	log.SetBackend(logBackendLeveled)
	logging.SetBackend(logBackendLeveled, logFormatter)

	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	teamname := os.Getenv("TEAMNAME")

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

		log.Debug("Fetching cached continue code")
		lastContinueCode := getCachedContinueCode(client, teamname)
		log.Debug("Fetching current continue code")
		currentContinueCode := getCurrentContinueCode()

		if lastContinueCode == nil && currentContinueCode == nil {
			log.Warning("Failed to fecth both current and cached contrinue code")
		} else if lastContinueCode == nil && currentContinueCode != nil {
			log.Debug("Did not find a cached continue code.")
			log.Debug("Last continue code was nil. This should only happen once per team.")
			cacheContinueCode(client, teamname, *currentContinueCode)
		} else if currentContinueCode == nil {
			log.Debug("Could not get current continue code. Juice Shop might be down. Sleeping and tretrying in 5 sec")
		} else {
			log.Debug("Checking Difference between continue code")
			if *lastContinueCode != *currentContinueCode {
				log.Debugf("Continue codes differ (last vs curr): (%s vs %s)", *lastContinueCode, *currentContinueCode)
				log.Debug("Applying cached continue code")
				applyContinueCode(*lastContinueCode)
				log.Debug("ReFetching current continue code")
				currentContinueCode = getCurrentContinueCode()

				log.Debug("Caching current continue code")
				cacheContinueCode(client, teamname, *currentContinueCode)
			} else {
				log.Debug("Continue codes are identical. Sleeping")
			}
		}
	}
}

func getCachedContinueCode(client *redis.Client, teamname string) *string {
	val, err := client.Get(fmt.Sprintf("t-%s-continue-code", teamname)).Result()

	if err != nil {
		log.Errorf("Could not get continue code from redis: %v", err)
		return nil
	}

	log.Infof("Got 't-%s-continue-code': '%s'", teamname, val)

	return &val
}

func getCurrentContinueCode() *string {
	url := "http://localhost:3000/rest/continue-code"

	req, err := http.NewRequest("GET", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request")
		log.Warning(err)
		return nil
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to fetch continue code from juice shop.")
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

		continueCodePayload := ContinueCodePayload{}

		err = json.Unmarshal(body, &continueCodePayload)

		if err != nil {
			log.Error("Failed to parse json of a challenge status.")
			log.Error(err)
			return nil
		}

		log.Debugf("Got current continue code: '%s'", continueCodePayload.ContinueCode)

		return &continueCodePayload.ContinueCode
	default:
		log.Warningf("Unexpected response status code '%d'", res.StatusCode)
		return nil
	}
}

func applyContinueCode(continueCode string) {
	url := fmt.Sprintf("http://localhost:3000/rest/continue-code/apply/%s", continueCode)

	req, err := http.NewRequest("PUT", url, bytes.NewBuffer([]byte{}))
	if err != nil {
		log.Warning("Failed to create http request to set the current continue code")
		log.Warning(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Warning("Failed to set the current continue code to juice shop.")
		log.Warning(err)
	}
	defer res.Body.Close()
}

func cacheContinueCode(client *redis.Client, teamname string, continueCode string) {
	log.Infof("Updating 't-%s-continue-code' to '%s'", teamname, continueCode)
	err := client.Set(fmt.Sprintf("t-%s-continue-code", teamname), continueCode, 0).Err()
	if err != nil {
		log.Error("Failed to persist current continue code to redis: %v", err)
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
