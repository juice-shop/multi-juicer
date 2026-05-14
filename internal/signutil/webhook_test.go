package signutil

import (
	"strings"
	"testing"
)

func TestSignWebhookTeam_Deterministic(t *testing.T) {
	sig1, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	sig2, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sig1 != sig2 {
		t.Fatalf("expected deterministic signatures, got %q and %q", sig1, sig2)
	}
}

func TestSignWebhookTeam_HexEncoding(t *testing.T) {
	sig, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// HMAC-SHA256 → 32 bytes → 64 hex chars.
	if len(sig) != 64 {
		t.Fatalf("expected 64 hex chars, got %d (%q)", len(sig), sig)
	}
	for _, r := range sig {
		isHex := (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f')
		if !isHex {
			t.Fatalf("expected lowercase hex only, got rune %q in %q", r, sig)
		}
	}
}

func TestVerifyWebhookTeam_Valid(t *testing.T) {
	sig, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := VerifyWebhookTeam("alpha", sig, "secret"); err != nil {
		t.Fatalf("expected valid signature to verify, got: %v", err)
	}
}

func TestVerifyWebhookTeam_WrongTeam(t *testing.T) {
	sig, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := VerifyWebhookTeam("beta", sig, "secret"); err == nil {
		t.Fatal("expected verification to fail for different team")
	}
}

func TestVerifyWebhookTeam_WrongKey(t *testing.T) {
	sig, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := VerifyWebhookTeam("alpha", sig, "other-secret"); err == nil {
		t.Fatal("expected verification to fail with different key")
	}
}

func TestVerifyWebhookTeam_TamperedSig(t *testing.T) {
	sig, err := SignWebhookTeam("alpha", "secret")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Flip the last hex char.
	var flipped byte = '0'
	if sig[len(sig)-1] == '0' {
		flipped = '1'
	}
	tampered := sig[:len(sig)-1] + string(flipped)
	if err := VerifyWebhookTeam("alpha", tampered, "secret"); err == nil {
		t.Fatal("expected tampered signature to fail")
	}
}

func TestSignWebhookTeam_Empty(t *testing.T) {
	if _, err := SignWebhookTeam("", "secret"); err == nil {
		t.Fatal("expected error for empty team")
	}
	if _, err := SignWebhookTeam("alpha", ""); err == nil {
		t.Fatal("expected error for empty key")
	}
}

// Webhook signatures must never collide with — or be parseable as — cookie signatures.
// Cookie format is "value.base64sig" (contains a literal '.'); webhook format is raw
// hex (no '.'). And vice versa: a Sign() output must not verify as a webhook sig.
func TestWebhookAndCookieFormatsAreDisjoint(t *testing.T) {
	key := "shared-secret-do-not-do-this"

	cookieSigned, err := Sign("alpha", key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	webhookSig, err := SignWebhookTeam("alpha", key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// A cookie value can never accidentally be a valid webhook signature.
	if err := VerifyWebhookTeam("alpha", cookieSigned, key); err == nil {
		t.Fatal("cookie-signed value must not verify as a webhook signature")
	}

	// The webhook signature (raw hex) must not contain a '.' — i.e. it cannot
	// be parsed as a "value.signature" cookie payload.
	if strings.Contains(webhookSig, ".") {
		t.Fatalf("webhook signature should not contain '.', got %q", webhookSig)
	}

	// And the webhook signature must not, on its own, be accepted as a signed cookie.
	if _, err := Unsign(webhookSig, key); err == nil {
		t.Fatal("webhook signature must not be accepted as a signed cookie")
	}
}
