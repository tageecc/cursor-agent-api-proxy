# cursor-agent-api-proxy

[![npm version](https://img.shields.io/npm/v/cursor-agent-api-proxy)](https://www.npmjs.com/package/cursor-agent-api-proxy)
[![npm downloads](https://img.shields.io/npm/dm/cursor-agent-api-proxy)](https://www.npmjs.com/package/cursor-agent-api-proxy)
[![license](https://img.shields.io/npm/l/cursor-agent-api-proxy)](./LICENSE)

[中文文档](./README.zh-CN.md)

OpenAI-compatible API proxy for the Cursor CLI. Lets [OpenClaw](https://docs.openclaw.ai), [Continue.dev](https://continue.dev), or any OpenAI-compatible client use your Cursor subscription.

Works on macOS, Linux, and Windows.

## Prerequisites

- **Node.js** 20+
- **Cursor CLI** (`agent`) — see step 1 below
- An active **Cursor subscription** (Pro / Business / etc.)

## Setup

### 1. Install and authenticate the Cursor CLI

**macOS / Linux / WSL:**

```bash
curl https://cursor.com/install -fsS | bash
```

**Windows (PowerShell):**

```powershell
irm 'https://cursor.com/install?win32=true' | iex
```

Then log in:

```bash
agent login
```

This opens a browser for you to sign in with your Cursor account. Once done, the CLI is ready.

> **Headless / CI usage:** If you can't open a browser, generate an API key in [Cursor Settings](https://cursor.com/settings) and set it as an environment variable instead:
>
> ```bash
> export CURSOR_API_KEY=your_key_here   # macOS / Linux
> ```
>
> ```powershell
> $env:CURSOR_API_KEY="your_key_here"   # Windows PowerShell
> ```

Verify the CLI works:

```bash
agent --list-models
```

### 2. Install and start the proxy

```bash
npm install -g cursor-agent-api-proxy
cursor-agent-api
```

The server starts on `http://localhost:4646`.

### 3. Verify

```bash
curl http://localhost:4646/health
```

Send a test request:

```bash
curl -X POST http://localhost:4646/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}]}'
```

## OpenClaw Configuration

```json5
{
  env: {
    OPENAI_API_KEY: "not-needed",
    OPENAI_BASE_URL: "http://localhost:4646/v1",
  },
  agents: {
    defaults: {
      model: { primary: "openai/cursor/auto" },
    },
  },
}
```

> If you logged in via `agent login`, `OPENAI_API_KEY` can be any non-empty value like `"not-needed"`. If you want to pass a specific Cursor API Key per-request, put it here — the proxy forwards it from the `Authorization` header to the CLI.

## Models

Prefix with `cursor/`:

| Model ID | Description |
|----------|-------------|
| `cursor/auto` | Auto-select |
| `cursor/opus-4.6-thinking` | Claude Opus 4.6 (thinking) |
| `cursor/opus-4.6` | Claude Opus 4.6 |
| `cursor/sonnet-4.5-thinking` | Claude Sonnet 4.5 (thinking) |
| `cursor/sonnet-4.5` | Claude Sonnet 4.5 |
| `cursor/gpt-5.3-codex` | GPT 5.3 Codex |
| `cursor/gpt-5.2` | GPT 5.2 |
| `cursor/gemini-3-pro` | Gemini 3 Pro |
| `cursor/grok` | Grok |

Dash format (`cursor-auto`, `cursor-opus-4.6`) also works for clients that don't allow `/` in model names. Full list: `GET /v1/models`.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (includes CLI version) |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | Chat completion (streaming supported) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4646` | Listen port (also via CLI arg: `cursor-agent-api 8080`) |
| `CURSOR_API_KEY` | - | Cursor API Key (alternative to `agent login`) |

## Auto-start Service

```bash
cursor-agent-api install    # register and start as system service
cursor-agent-api uninstall  # remove
```

- macOS → LaunchAgent
- Windows → Task Scheduler
- Linux → systemd user service

## Other Clients

<details>
<summary>Python (openai SDK)</summary>

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4646/v1",
    api_key="not-needed",
)

resp = client.chat.completions.create(
    model="cursor/auto",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)
```

</details>

<details>
<summary>Continue.dev</summary>

```json
{
  "models": [{
    "title": "Cursor",
    "provider": "openai",
    "model": "cursor/auto",
    "apiBase": "http://localhost:4646/v1",
    "apiKey": "not-needed"
  }]
}
```

</details>

## How it Works

```
Client (OpenClaw / Python / curl ...)
    │  POST /v1/chat/completions  (OpenAI format)
    ▼
cursor-agent-api-proxy
    │  spawn("agent", ["-p", "--output-format", "stream-json", ...])
    ▼
Cursor CLI (agent)
    │  uses your Cursor subscription
    ▼
AI response → OpenAI format → client
```

## Contributing

```bash
git clone https://github.com/tageecc/cursor-agent-api-proxy.git
cd cursor-agent-api-proxy
pnpm install && pnpm run build
pnpm start
```

## License

MIT
