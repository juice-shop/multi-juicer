package adminmessage

import "time"

type Message struct {
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Level     string    `json:"level"`
	UpdatedAt time.Time `json:"updatedAt"`
}
