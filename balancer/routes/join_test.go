package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
)

func TestJoinHandler(t *testing.T) {
	team := "foobar"

	t.Run("creates a deployment and service on join", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset()

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		actions := clientset.Actions()
		_ = actions
		assert.Equal(t, http.StatusOK, rr.Code)

		// should first check if deployment exists
		assert.Equal(t, "get", actions[0].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[0].GetResource())

		// because it doesn't it should create it and a service for it
		assert.Equal(t, "create", actions[1].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[1].GetResource())
		assert.Equal(t, "create", actions[2].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, actions[2].GetResource())

		assert.JSONEq(t, `{"message":"Created Instance","passcode":"12345678"}`, rr.Body.String())
	})
}
