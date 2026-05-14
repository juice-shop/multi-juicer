package signutil

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
)

// webhookSignaturePrefix is mixed into the HMAC input so that even if the same
// secret were ever (mis)used for both webhook signing and cookie signing, the
// resulting signatures would still differ. Combined with the hex (not "value.b64")
// output format, this gives strong domain separation from Sign/Unsign above.
const webhookSignaturePrefix = "multijuicer-webhook-v1:"

// SignWebhookTeam returns the hex-encoded HMAC-SHA256 of the team name, prefixed
// by a domain-separation tag. The returned string contains only lowercase hex
// characters — deliberately different from Sign's "value.base64sig" format so
// that a leaked webhook URL can never be parsed/accepted as a signed cookie.
func SignWebhookTeam(team, key string) (string, error) {
	if team == "" {
		return "", errors.New("team must be provided")
	}
	if key == "" {
		return "", errors.New("signing key must be provided")
	}

	h := hmac.New(sha256.New, []byte(key))
	h.Write([]byte(webhookSignaturePrefix))
	h.Write([]byte(team))
	return hex.EncodeToString(h.Sum(nil)), nil
}

// VerifyWebhookTeam returns nil if sig is a valid signature of team produced by
// SignWebhookTeam with the same key, using a constant-time comparison.
func VerifyWebhookTeam(team, sig, key string) error {
	expected, err := SignWebhookTeam(team, key)
	if err != nil {
		return err
	}
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return errors.New("webhook signature mismatch")
	}
	return nil
}
