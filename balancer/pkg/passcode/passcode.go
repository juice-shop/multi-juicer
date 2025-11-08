package passcode

import (
	"crypto/rand"
	"math/big"
)

const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func GetPasscodeGeneratorWithPasscodeLength(passcodeLength int) func() string {
	return func() string {
		passcode := make([]byte, passcodeLength)
		charsetLength := big.NewInt(int64(len(charset)))

		for i := range passcode {
			randomIndex, err := rand.Int(rand.Reader, charsetLength)
			if err != nil {
				panic(err)
			}
			passcode[i] = charset[randomIndex.Int64()]
		}

		return string(passcode)
	}
}
