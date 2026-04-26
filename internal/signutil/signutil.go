package signutil

// based on https://github.com/tj/node-cookie-signature

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

// Sign the given `val` with `secret`.
// Returns the signed string.
func Sign(val, secret string) (string, error) {
	if val == "" {
		return "", errors.New("cookie value must be provided as a string")
	}
	if secret == "" {
		return "", errors.New("secret key must be provided")
	}

	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(val))
	signature := base64.StdEncoding.EncodeToString(h.Sum(nil))

	// Remove any trailing '=' characters from the base64-encoded string
	signature = strings.TrimRight(signature, "=")
	return val + "." + signature, nil
}

// Unsign and decode the given `input` with `secret`.
// Returns the original value if the signature is valid, otherwise returns false.
func Unsign(input, secret string) (string, error) {
	if input == "" {
		return "", errors.New("signed cookie string must be provided")
	}
	if secret == "" {
		panic("missing secret key for signed cookies")
	}

	lastDotIndex := strings.LastIndex(input, ".")
	if lastDotIndex == -1 {
		return "", errors.New("invalid signed cookie string. no '.' found")
	}

	tentativeValue := input[:lastDotIndex]
	expectedSignedValue, err := Sign(tentativeValue, secret)
	if err != nil {
		return "", err
	}

	// Use hmac.Equal for timing-safe comparison
	if hmac.Equal([]byte(input), []byte(expectedSignedValue)) {
		return tentativeValue, nil
	}
	return "", errors.New("signature mismatch")
}
