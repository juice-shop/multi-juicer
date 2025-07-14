package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

type CategoryStat struct {
	Category string `json:"category"`
	Solves   int    `json:"solves"`
}

type ScoreBucket struct {
	Range string `json:"range"`
	Count int    `json:"count"`
}

type StatisticsResponse struct {
	CategoryStats     []CategoryStat `json:"categoryStats"`
	ScoreDistribution []ScoreBucket  `json:"scoreDistribution"`
}

func handleStatistics(bundle *b.Bundle, scoringService *scoring.ScoringService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allTeamScores := scoringService.GetScores()
		challengeMap := make(map[string]b.JuiceShopChallenge)
		for _, ch := range bundle.JuiceShopChallenges {
			challengeMap[ch.Key] = ch
		}

		// 1. Calculate Category Statistics
		categoryCounts := make(map[string]int)
		for _, teamScore := range allTeamScores {
			for _, solvedChallenge := range teamScore.Challenges {
				if details, ok := challengeMap[solvedChallenge.Key]; ok {
					categoryCounts[details.Category]++
				}
			}
		}
		categoryStats := make([]CategoryStat, 0, len(categoryCounts))
		for category, count := range categoryCounts {
			categoryStats = append(categoryStats, CategoryStat{Category: category, Solves: count})
		}
		// Sort for consistent ordering
		sort.Slice(categoryStats, func(i, j int) bool {
			return categoryStats[i].Solves > categoryStats[j].Solves
		})

		// 2. Calculate Score Distribution
		// Buckets of 100 points, up to 1000, then 1000+
		scoreBuckets := make([]ScoreBucket, 11)
		for i := 0; i < 10; i++ {
			scoreBuckets[i] = ScoreBucket{Range: fmt.Sprintf("%d-%d", i*100, (i+1)*100-1)}
		}
		scoreBuckets[10] = ScoreBucket{Range: "1000+"}

		for _, teamScore := range allTeamScores {
			bucketIndex := teamScore.Score / 100
			if bucketIndex >= 10 {
				bucketIndex = 10 // Put everything >= 1000 in the last bucket
			}
			if bucketIndex >= 0 {
				scoreBuckets[bucketIndex].Count++
			}
		}

		// 3. Construct and send the response
		response := StatisticsResponse{
			CategoryStats:     categoryStats,
			ScoreDistribution: scoreBuckets,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
