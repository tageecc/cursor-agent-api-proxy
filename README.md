# cursor-agent-api-proxy

把你的 Cursor 订阅变成 OpenAI 兼容的 API 接口。

本项目将 Cursor CLI（`agent` 命令）包装为标准的 HTTP API 服务，让 [OpenClaw](https://docs.openclaw.ai)、[Continue.dev](https://continue.dev) 等任何支持 OpenAI 格式的工具都能直接调用你的 Cursor 订阅额度。

支持 macOS、Linux、Windows。

## 快速开始

### 1. 安装 Cursor CLI

**macOS / Linux / WSL：**

```bash
curl https://cursor.com/install -fsS | bash
export CURSOR_API_KEY=your_key_here
```

**Windows (PowerShell)：**

```powershell
irm 'https://cursor.com/install?win32=true' | iex
$env:CURSOR_API_KEY="your_key_here"
```

### 2. 安装本项目

**方式 A — npm 全局安装（推荐）：**

```bash
npm install -g cursor-agent-api-proxy
cursor-agent-api
```

**方式 B — 从源码：**

```bash
git clone https://github.com/tageecc/cursor-agent-api-proxy.git
cd cursor-agent-api-proxy
pnpm install && pnpm run build
pnpm start
```

服务默认运行在 `http://localhost:4646`。

## 试一下

**macOS / Linux / WSL：**

```bash
# 非流式
curl -X POST http://localhost:4646/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}]}'

# 流式
curl -N -X POST http://localhost:4646/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}],"stream":true}'
```

**Windows (PowerShell)：**

```powershell
# 非流式
Invoke-RestMethod -Method POST -Uri http://localhost:4646/v1/chat/completions `
  -ContentType "application/json" `
  -Body '{"model":"cursor/auto","messages":[{"role":"user","content":"Hello!"}]}' | ConvertTo-Json -Depth 10

# 流式 (curl.exe 在 Windows 10+ 内置)
curl.exe -N -X POST http://localhost:4646/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d '{\"model\":\"cursor/auto\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}],\"stream\":true}'
```

## 配置 OpenClaw

```json5
{
  env: {
    // 填你的 Cursor API Key，会透传给 Cursor CLI
    OPENAI_API_KEY: "your_cursor_api_key",
    OPENAI_BASE_URL: "http://localhost:4646/v1",
  },
  agents: {
    defaults: {
      model: { primary: "openai/cursor/auto" },
    },
  },
}
```

> `OPENAI_API_KEY` 可以直接填你的 Cursor API Key。代理会从 `Authorization` header 提取并透传给 Cursor CLI。如果你已经在系统环境变量里设置了 `CURSOR_API_KEY`，这里填 `"not-needed"` 也行。

## 支持的模型

通过 `cursor/` 前缀指定模型：

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

也支持 `cursor-auto`、`cursor-opus-4.6` 等 dash 格式（兼容不支持 `/` 的客户端）。

完整列表调 `GET /v1/models` 查看。

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（含 CLI 版本） |
| `/v1/models` | GET | 可用模型列表 |
| `/v1/chat/completions` | POST | 聊天补全（支持流式） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `4646` | 监听端口 |
| `CURSOR_API_KEY` | - | Cursor API Key（也可通过 Authorization header 传递） |

端口也可以通过命令行参数指定：`cursor-agent-api 8080`

## 原理

```
你的客户端 (OpenClaw / Python / curl ...)
    │
    │  POST /v1/chat/completions  (OpenAI 格式)
    ▼
cursor-agent-api-proxy (本项目)
    │
    │  spawn("agent", ["-p", "--output-format", "stream-json", ...])
    │  prompt 通过 stdin 传入
    ▼
Cursor CLI (agent)
    │
    │  使用你的 Cursor 订阅额度
    ▼
AI 模型响应 → 转为 OpenAI 格式 → 返回客户端
```

## 其他客户端配置

### Python (openai SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4646/v1",
    api_key="your_cursor_api_key",  # 或 "not-needed"
)

resp = client.chat.completions.create(
    model="cursor/auto",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)
```

### Continue.dev

```json
{
  "models": [{
    "title": "Cursor",
    "provider": "openai",
    "model": "cursor/auto",
    "apiBase": "http://localhost:4646/v1",
    "apiKey": "your_cursor_api_key"
  }]
}
```

## 开机自启

```bash
cursor-agent-api install    # 注册为系统服务并启动
cursor-agent-api uninstall  # 移除
```

会根据当前系统注册对应的服务：
- macOS → LaunchAgent
- Windows → Task Scheduler
- Linux → systemd user service

已设置 `CURSOR_API_KEY` 环境变量的话，会自动写入服务配置。

## 项目结构

```
src/
├── index.ts               # 包导出
├── types/
│   ├── cursor-cli.ts      # Cursor CLI stream-json 输出类型
│   └── openai.ts          # OpenAI API 类型
├── adapter/
│   ├── openai-to-cli.ts   # OpenAI 请求 → CLI prompt
│   └── cli-to-openai.ts   # CLI 输出 → OpenAI 响应
├── subprocess/
│   └── manager.ts         # agent 子进程管理
├── service/
│   └── install.ts         # install / uninstall 服务注册
└── server/
    ├── index.ts           # Express 服务
    ├── routes.ts          # API 路由
    └── standalone.ts      # CLI 入口
```

## License

MIT
