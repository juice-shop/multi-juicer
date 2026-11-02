package bundle

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetJuiceShopUrlForTeam(t *testing.T) {
	t.Run("should include team and namespace in the url", func(t *testing.T) {
		assert.Equal(t, "http://juiceshop-foobar.test-namespace.svc.cluster.local:3000", getJuiceShopUrlForTeam("foobar", &Bundle{
			RuntimeEnvironment: RuntimeEnvironment{
				Namespace: "test-namespace",
			},
		}))
	})
}

func TestValidateClassProgressConfig(t *testing.T) {
	challenges := []JuiceShopChallenge{
		{Key: "scoreBoardChallenge"},
		{Key: "loginAdminChallenge"},
		{Key: "localXssChallenge"},
	}

	t.Run("accepts an empty config", func(t *testing.T) {
		assert.NoError(t, validateClassProgressConfig(ClassProgressConfig{}, challenges))
	})

	t.Run("accepts known challenges", func(t *testing.T) {
		assert.NoError(t, validateClassProgressConfig(ClassProgressConfig{
			Mandatory: []string{"scoreBoardChallenge", "loginAdminChallenge"},
			Suggested: []string{"localXssChallenge"},
		}, challenges))
	})

	t.Run("rejects unknown challenges", func(t *testing.T) {
		err := validateClassProgressConfig(ClassProgressConfig{
			Suggested: []string{"loginAdmnChallenge"},
		}, challenges)
		assert.ErrorContains(t, err, `unknown challenge "loginAdmnChallenge"`)
	})

	t.Run("rejects challenges listed twice", func(t *testing.T) {
		err := validateClassProgressConfig(ClassProgressConfig{
			Mandatory: []string{"scoreBoardChallenge"},
			Suggested: []string{"scoreBoardChallenge"},
		}, challenges)
		assert.ErrorContains(t, err, `"scoreBoardChallenge" more than once`)
	})
}
