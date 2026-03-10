# cursor-agent-api-proxy

[![npm version](https://img.shields.io/npm/v/cursor-agent-api-proxy)](https://www.npmjs.com/package/cursor-agent-api-proxy)
[![npm downloads](https://img.shields.io/npm/dm/cursor-agent-api-proxy)](https://www.npmjs.com/package/cursor-agent-api-proxy)
[![license](https://img.shields.io/npm/l/cursor-agent-api-proxy)](./LICENSE)

[English](./README.md)

Cursor CLI 的 OpenAI 兼容 API 代理。让 [OpenClaw](https://docs.openclaw.ai)、[Continue.dev](https://continue.dev) 等任何 OpenAI 兼容客户端直接使用你的 Cursor 订阅。

支持 macOS、Linux、Windows。

## 前置条件

- **Node.js** 20+
- **Cursor CLI** (`agent`) — 见下方步骤 1
- 有效的 **Cursor 订阅**（Pro / Business 等）

## 安装

### 1. 安装并认证 Cursor CLI

**macOS / Linux / WSL：**

```bash
curl https://cursor.com/install -fsS | bash
```

**Windows (PowerShell)：**

```powershell
irm 'https://cursor.com/install?win32=true' | iex
```

登录：

```bash
agent login
```

会打开浏览器，用你的 Cursor 账号登录即可。

> **无头环境 / CI：** 无法打开浏览器时，到 [Cursor Settings](https://cursor.com/settings) 生成 API Key，通过环境变量传入：
>
> ```bash
> export CURSOR_API_KEY=your_key_here   # macOS / Linux
> ```
>
> ```powershell
> $env:CURSOR_API_KEY="your_key_here"   # Windows PowerShell
> ```

确认 CLI 可用：

```bash
agent --list-models
```

### 2. 安装并启动代理

```bash
npm install -g cursor-agent-api-proxy
cursor-agent-api
```

服务默认运行在 `http://localhost:4646`。

### 3. 验证

```bash
curl http://localhost:4646/health
```

发送测试请求：

```bash
curl -X POST http://localhost:4646/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}]}'
```

## 配置 OpenClaw

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

> 如果已通过 `agent login` 登录，`OPENAI_API_KEY` 填任意非空值如 `"not-needed"` 即可。如果需要按请求传入特定的 Cursor API Key，填在这里——代理会从 `Authorization` header 提取并转发给 CLI。

## 支持的模型

通过 `cursor/` 前缀指定：

| Model ID | 说明 |
|----------|------|
| `cursor/auto` | 自动选择 |
| `cursor/opus-4.6-thinking` | Claude Opus 4.6 (thinking) |
| `cursor/opus-4.6` | Claude Opus 4.6 |
| `cursor/sonnet-4.5-thinking` | Claude Sonnet 4.5 (thinking) |
| `cursor/sonnet-4.5` | Claude Sonnet 4.5 |
| `cursor/gpt-5.3-codex` | GPT 5.3 Codex |
| `cursor/gpt-5.2` | GPT 5.2 |
| `cursor/gemini-3-pro` | Gemini 3 Pro |
| `cursor/grok` | Grok |

也支持 dash 格式（`cursor-auto`、`cursor-opus-4.6`），兼容不支持 `/` 的客户端。完整列表：`GET /v1/models`。

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（含 CLI 版本） |
| `/v1/models` | GET | 可用模型列表 |
| `/v1/chat/completions` | POST | 聊天补全（支持流式） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `4646` | 监听端口（也可命令行指定：`cursor-agent-api 8080`） |
| `CURSOR_API_KEY` | - | Cursor API Key（`agent login` 的替代方案） |

## 开机自启

```bash
cursor-agent-api install    # 注册为系统服务并启动
cursor-agent-api uninstall  # 移除
```

- macOS → LaunchAgent
- Windows → Task Scheduler
- Linux → systemd user service

## 其他客户端

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

## 原理

```
客户端 (OpenClaw / Python / curl ...)
    │  POST /v1/chat/completions  (OpenAI 格式)
    ▼
cursor-agent-api-proxy
    │  spawn("agent", ["-p", "--output-format", "stream-json", ...])
    ▼
Cursor CLI (agent)
    │  使用你的 Cursor 订阅额度
    ▼
AI 响应 → 转为 OpenAI 格式 → 返回客户端
```

## 参与开发

```bash
git clone https://github.com/tageecc/cursor-agent-api-proxy.git
cd cursor-agent-api-proxy
pnpm install && pnpm run build
pnpm start
```

## License

MIT
