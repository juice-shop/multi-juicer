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
