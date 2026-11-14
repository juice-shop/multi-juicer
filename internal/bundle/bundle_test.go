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
	t.Run("enables all views when the views config is missing", func(t *testing.T) {
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
}
