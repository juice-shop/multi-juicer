package adminmessage

import "time"

type Message struct {
	Text      string    `json:"text"`
	UpdatedAt time.Time `json:"updatedAt"`
}
