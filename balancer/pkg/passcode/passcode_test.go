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

	t.Run("generated passcodes should include numbers and letters", func(t *testing.T) {
		passcodes := ""
		// append 100 passcodes into a string to ensure that we have a good sample size
		for i := 0; i < 100; i++ {
			passcode := GeneratePasscode()
			passcodes += passcode
		}

		//check that we have at least one letter
		assert.Regexp(t, "[A-Z]", passcodes)

		//check that we have at least one number
		assert.Regexp(t, "[0-9]", passcodes)
	})
}
