package passcode

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

func GeneratePasscode() string {
	// Define the upper limit for an 8-digit number
	max := big.NewInt(100000000) // 10^8 = 100000000

	// Generate a cryptographically secure random number
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		panic(err)
	}

	// Format the number as an 8-digit string with leading zeros if necessary
	return fmt.Sprintf("%08d", n.Int64())
}
