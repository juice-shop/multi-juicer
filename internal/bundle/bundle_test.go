package bundle

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func writeConfigFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	return path
}

func TestReadConfigFromFile(t *testing.T) {
	t.Run("uses the default views config when the views config is missing", func(t *testing.T) {
		config, err := readConfigFromFile(writeConfigFile(t, `{"maxInstances": 10}`))
		require.NoError(t, err)
		assert.Equal(t, DefaultViewsConfig(), config.Views)
	})

	t.Run("only disables the views disabled in the config", func(t *testing.T) {
		config, err := readConfigFromFile(writeConfigFile(t, `{"views": {"ctf": {"enabled": false}}}`))
		require.NoError(t, err)
		assert.True(t, config.Views.ScoreOverview.Enabled)
		assert.False(t, config.Views.Ctf.Enabled)
	})

	t.Run("reads the class progress groups and keeps the defaults of the other views", func(t *testing.T) {
		config, err := readConfigFromFile(writeConfigFile(t, `{"views": {"classProgress": {"enabled": true, "groups": [{"name": "Week 1", "challenges": ["scoreBoardChallenge", "localXssChallenge"]}]}}}`))
		require.NoError(t, err)
		assert.True(t, config.Views.ScoreOverview.Enabled)
		assert.True(t, config.Views.Ctf.Enabled)
		assert.Equal(t, ClassProgressViewConfig{
			Enabled: true,
			Groups:  []ChallengeGroup{{Name: "Week 1", Challenges: []string{"scoreBoardChallenge", "localXssChallenge"}}},
		}, config.Views.ClassProgress)
	})
}

func TestValidateClassProgressConfig(t *testing.T) {
	challenges := []JuiceShopChallenge{{Key: "scoreBoardChallenge"}, {Key: "localXssChallenge"}}

	t.Run("ignores the groups of a disabled class progress", func(t *testing.T) {
		assert.NoError(t, validateClassProgressConfig(ClassProgressViewConfig{
			Groups: []ChallengeGroup{{Name: "Week 1", Challenges: []string{"unknownChallenge"}}},
		}, challenges))
	})

	t.Run("accepts groups of known challenges", func(t *testing.T) {
		assert.NoError(t, validateClassProgressConfig(ClassProgressViewConfig{
			Enabled: true,
			Groups:  []ChallengeGroup{{Name: "Week 1", Challenges: []string{"scoreBoardChallenge", "localXssChallenge"}}},
		}, challenges))
	})

	t.Run("rejects an enabled class progress without groups", func(t *testing.T) {
		err := validateClassProgressConfig(ClassProgressViewConfig{Enabled: true}, challenges)
		assert.EqualError(t, err, "views.classProgress.groups must not be empty")
	})

	t.Run("rejects unknown challenges", func(t *testing.T) {
		err := validateClassProgressConfig(ClassProgressViewConfig{
			Enabled: true,
			Groups:  []ChallengeGroup{{Name: "Week 1", Challenges: []string{"loginAdmnChallenge"}}},
		}, challenges)
		assert.EqualError(t, err, `views.classProgress.groups contains unknown challenge "loginAdmnChallenge"`)
	})
}
