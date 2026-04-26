# AI / LLM Chatbot Setup

Note: Only available with MultiJuicer >= v10 & JuiceShop >= v20. Currently not yet available.

Juice Shop includes an AI chatbot powered by an external LLM via an OpenAI-compatible API. MultiJuicer supports this through a built-in **LLM Gateway** that proxies requests from JuiceShop instances to your LLM provider, without exposing the real API key to participants.

## Why a gateway?

Juice Shop contains Remote Code Execution (RCE) challenges. If you inject the LLM API key directly into JuiceShop pods, any participant who solves an RCE challenge can extract it trivially. This could allow them to:

- Run up your API bill with unrestricted access
- Use your API key for purposes outside the event

The LLM Gateway solves this by keeping the real API key inside the balancer and giving each team a unique token that only works through the gateway.

## How it works

```
JuiceShop Pod (team-a)                    Balancer Process
  LLM_API_KEY=<unique-team-token>  -->  :8082 (LLM Gateway)
  chatBot.llmApiUrl=http://                 | validates team token
    multijuicer-llm-gateway:8082            | swaps in real API key
                                            | tracks token usage
                                            v
                                       Upstream LLM API
                                       (OpenAI / OpenRouter / Ollama / ...)
```

1. When a team is created, the balancer generates a random token and stores it in a Kubernetes Secret. This token is mounted as the `LLM_API_KEY` environment variable in the JuiceShop pod.
2. The JuiceShop chatbot config is automatically set to point at the internal `multijuicer-llm-gateway` service instead of the real LLM API.
3. When JuiceShop makes a chat completion request, the gateway validates the team token, replaces it with the real API key, and forwards the request upstream.
4. The gateway extracts token usage from responses (including SSE streams) and periodically writes per-team input/output token counts to the team's deployment annotations (`multi-juicer.owasp-juice.shop/llmInputTokens` and `multi-juicer.owasp-juice.shop/llmOutputTokens`).

The gateway service is ClusterIP-only and not exposed outside the cluster.

## Configuration

### Step 1. Create a Kubernetes Secret with your API key

```bash
kubectl create secret generic multi-juicer-llm \
  --from-literal=token='sk-your-actual-api-key'
```

### Step 2. Configure MultiJuicer

Add the following to your Helm values:

```yaml
config:
  juiceShop:
    llm:
      enabled: true
      model: "qwen/qwen3.5-9b"
      apiUrl: "https://openrouter.ai/api/v1"
      existingSecret:
        name: "multi-juicer-llm"
        key: "token"
```

| Field | Description |
|-------|-------------|
| `enabled` | Set to `true` to enable the LLM gateway. |
| `model` | The model identifier passed to JuiceShop's chatbot config. Must match a model available at your LLM provider. |
| `apiUrl` | The base URL of your OpenAI-compatible LLM API, including the path prefix (e.g. `https://api.openai.com/v1`, `http://ollama:11434/v1`). |
| `existingSecret.name` | Name of the Kubernetes Secret containing your LLM API key. |
| `existingSecret.key` | The key within that Secret that holds the API key value. |

### Step 3. Install or upgrade

```bash
helm upgrade --install multi-juicer oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer \
  -f values.yaml
```

### Monitoring token usage

You can check per-team LLM token usage via the deployment annotations:

```bash
kubectl get deployments -l app.kubernetes.io/part-of=multi-juicer,app.kubernetes.io/name=juice-shop \
  -o custom-columns='TEAM:.metadata.labels.team,INPUT_TOKENS:.metadata.annotations.multi-juicer\.owasp-juice\.shop/llmInputTokens,OUTPUT_TOKENS:.metadata.annotations.multi-juicer\.owasp-juice\.shop/llmOutputTokens'
```

## RBAC note

Enabling the LLM gateway grants the balancer's service account additional permissions: it can **create, get, delete, and list Secrets** in the namespace. This is required to manage the per-team LLM tokens. The cleaner job also gets permissions to **get and delete Secrets** so it can clean up tokens when removing inactive teams.

If you are running MultiJuicer in a namespace shared with other workloads, be aware that the balancer will have read access to all Secrets in that namespace. Running MultiJuicer in a dedicated namespace (which is recommended regardless) avoids this concern.

## What it protects against

- **API key extraction**: The real API key never reaches JuiceShop pods. Even if a participant achieves RCE, they only find a team-specific token that is useless outside the cluster.
- **Usage visibility**: Per-team token counts let you identify unusual usage patterns.

## What to still be cautious about

- **No per-team rate limiting**: The gateway does not currently enforce rate limits. A participant could make rapid-fire requests through the JuiceShop chatbot and consume significant tokens. Monitor usage annotations during your event and consider setting spending limits at your LLM provider.
- **Team token scope**: A team's token grants access to the full LLM API through the gateway (not just chat completions). If your upstream API exposes other endpoints (e.g. embeddings, image generation), those are accessible too.
- **Extracted team tokens work within the cluster**: If a participant extracts their team token via RCE, they can use it to make direct requests to the gateway from within the cluster (bypassing the JuiceShop UI). This isn't a significant concern since they could already use the chatbot normally, but it does allow usage outside the intended JuiceShop chatbot flow.
- **Provider-side limits**: Set up billing alerts and spending caps at your LLM provider as an additional safety net. The gateway tracks usage for visibility, but does not enforce cost limits itself.
