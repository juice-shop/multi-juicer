package passcode

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPasscode(t *testing.T) {
	generatePasscode := GetPasscodeGeneratorWithPasscodeLength(8)

	t.Run("should be 8 chars long", func(t *testing.T) {
		assert.Len(t, generatePasscode(), 8)
	})

	t.Run("should support different length when curried differently", func(t *testing.T) {
		generatePasscode := GetPasscodeGeneratorWithPasscodeLength(24)
		assert.Len(t, generatePasscode(), 24)
	})

	t.Run("should generally be not equal", func(t *testing.T) {
		// note: there is a very small chance that this will fail randomly if we are extremely unlucky
		assert.NotEqual(t, generatePasscode(), generatePasscode())
	})

	t.Run("generated passcodes should include numbers and letters", func(t *testing.T) {
		passcodes := ""
		// append 100 passcodes into a string to ensure that we have a good sample size
		for range 100 {
			passcode := generatePasscode()
			passcodes += passcode
		}

		//check that we have at least one letter
		assert.Regexp(t, "[A-Z]", passcodes)

		//check that we have at least one number
		assert.Regexp(t, "[0-9]", passcodes)
	})
}
