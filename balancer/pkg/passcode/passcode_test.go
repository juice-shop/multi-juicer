package passcode

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPasscode(t *testing.T) {
	t.Run("should be 8 chars long", func(t *testing.T) {
		assert.Len(t, GeneratePasscode(), 8)
	})

	t.Run("should generally be not equal", func(t *testing.T) {
		// note: there is a very small chance that this will fail randomly if we are extremely unlucky
		assert.NotEqual(t, GeneratePasscode(), GeneratePasscode())
	})
}
