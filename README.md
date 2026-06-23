# Claude Code — Leaked Source (2026-03-31)

> **On March 31, 2026, the full source code of Anthropic's Claude Code CLI was leaked** via a `.map` file exposed in their npm registry.

---

## How It Leaked

[Chaofan Shou (@Fried_rice)](https://x.com/Fried_rice) discovered the leak and posted it publicly:

> **"Claude code source code has been leaked via a map file in their npm registry!"**
>
> — [@Fried_rice, March 31, 2026](https://x.com/Fried_rice/status/2038894956459290963)

The source map file in the published npm package contained a reference to the full, unobfuscated TypeScript source, which was downloadable as a zip archive from Anthropic's R2 storage bucket.

---

## Quick Setup

### Prerequisites

- **[Bun](https://bun.sh)** v1.3+ (the project's runtime)
- **Node.js** v18+ (for npm package installation)
- An **Anthropic API key** (set as `ANTHROPIC_API_KEY` environment variable) or third party provider such as deepseek.

> ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
> ANTHROPIC_AUTH_TOKEN=sk-xxx
> ANTHROPIC_MODEL=deepseek-v4-pro[1m]
> ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
> ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
> ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
> ANTHROPIC_SMALL_FAST_MODEL=deepseek-v4-flash
> CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
> CLAUDE_CODE_EFFORT_LEVEL=max

### Install & Run

```bash
# 1. Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bash_profile  # or restart your terminal

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Setup .env
cat << EOF
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=sk-xxx
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
ANTHROPIC_SMALL_FAST_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
EOF >> .env

# 3. Run Claude Code
source .env && bun run start

# Or with arguments:
bun run start -- --help
bun run start -- --version
bun run start -- -p "Hello Claude"
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run start` | Run Claude Code CLI |
| `bun run dev` | Run with hot-reloading (--watch) |
| `bun run build` | Bundle for production |
| `bun run typecheck` | Run TypeScript type checking |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required to use Claude) |
| `FEATURE_FLAGS` | Comma-separated list of feature flags to enable (e.g., `KAIROS,VOICE_MODE`) |

### Notes

- Some modules from the original source were not included in the leak (Anthropic-internal `@ant/*` packages, some tools). These have been replaced with stubs that export no-ops.
- The `bun:bundle` feature flag system is shimmed via a Bun plugin at `plugins/bunBundleDev.ts`. All flags default to `false` unless enabled via `FEATURE_FLAGS`.
- The `MACRO.*` build-time constants are defined in `bunfig.toml` and injected by Bun's `--define` system.

---

## Overview

Claude Code is Anthropic's official CLI tool that lets you interact with Claude directly from the terminal to perform software engineering tasks — editing files, running commands, searching codebases, managing git workflows, and more.

This repository contains the leaked `src/` directory.

- **Leaked on**: 2026-03-31
- **Language**: TypeScript
- **Runtime**: Bun
- **Terminal UI**: React + [Ink](https://github.com/vadimdemedes/ink) (React for CLI)
- **Scale**: ~1,900 files, 512,000+ lines of code

---

## Directory Structure

```
src/
├── entrypoints/cli.tsx       # Bootstrap + fast-path routing
├── main.tsx                 # Full CLI startup + REPL launch
├── query.ts                 # LLM query loop (Anthropic API + tool calling)
├── context.ts               # System/user context collection
├── commands.ts              # Command registry (~80+ slash commands)
├── tools.ts                 # Tool registry (~50+ agent tools)
├── Tool.ts                  # Tool type definitions
├── cost-tracker.ts          # Token cost tracking
│
├── commands/                # Slash command implementations (~50)
├── tools/                   # Agent tool implementations (~40)
├── components/              # Ink UI components (~140)
├── hooks/                   # React hooks
├── services/                # External service integrations
├── screens/                 # Full-screen UIs (Doctor, REPL, Resume)
├── types/                   # TypeScript type definitions
├── utils/                   # Utility functions
│
├── bridge/                  # IDE integration bridge (VS Code, JetBrains)
├── coordinator/             # Multi-agent coordinator
├── plugins/                 # Plugin system
├── skills/                  # Skill system
├── keybindings/             # Keybinding configuration
├── vim/                     # Vim mode
├── voice/                   # Voice input
├── remote/                  # Remote sessions
├── server/                  # Server mode
├── memdir/                  # Memory directory (persistent memory)
├── tasks/                   # Task management
├── state/                   # State management
├── migrations/              # Config migrations
├── schemas/                 # Config schemas (Zod)
├── entrypoints/             # Initialization logic
├── ink/                     # Ink renderer wrapper
├── buddy/                   # Companion sprite (Easter egg)
├── native-ts/               # Native TypeScript utils
├── outputStyles/            # Output styling
├── query/                   # Query pipeline
└── upstreamproxy/           # Proxy configuration
```

---

## Core Execution Flow

### 一、入口路由（`src/entrypoints/cli.tsx`）

进程启动后立即进入 `main()` 函数，按优先级依次检查命令行参数。每个分支都是**动态 import**，只加载所需模块：

```
1. --version / -v        → 零导入，直接打印版本退出
2. --dump-system-prompt  → 加载 model/config，输出系统提示词退出
3. --daemon-worker       → 启动守护进程 worker 退出
4. remote-control/bridge → Bridge 远程控制模式（认证 → 策略检查 → bridgeMain）
5. daemon                → 守护进程主管模式
6. ps/logs/attach/kill   → 后台会话管理（~/.claude/sessions/ 注册表）
7. new/list/reply        → 模板任务命令
8. environment-runner    → headless BYOC 执行器
9. --worktree --tmux     → 先 exec 进 tmux，再走正常 CLI
10. 无特殊标志匹配        → 加载完整 CLI：import('../main.js') → cliMain()
```

### 二、完整 CLI 启动（`src/main.tsx` — `main()`）

```
main()
  ├── 安全设置（PATH 注入防护）
  ├── 信号处理（SIGINT / SIGTERM）
  ├── 协议/URI 处理（cc:// 直连、deep link、assistant、ssh）
  ├── 判断交互模式
  │   ├── -p / --print / --init-only → 非交互（headless）模式
  │   └── 有 TTY → 交互模式
  ├── 并行初始化阶段
  │   ├── init()                         ← 配置 + GrowthBook + 遥测
  │   ├── MDM 托管配置读取（提前启动子进程）
  │   └── keychain 凭证预取（macOS）
  ├── 配置迁移（model 名、权限设置等 11 项历史迁移）
  ├── Commander.js CLI 选项解析（权限模式、model、工具列表等）
  ├── 加载启动数据
  │   ├── fetchBootstrapData()           ← API 调用（用户信息、配额等）
  │   ├── getCommands()                  ← 加载所有斜杠命令
  │   │   ├── 内置命令（COMMANDS）
  │   │   ├── Skills 目录命令（用户自定义 SKILL.md）
  │   │   ├── Plugin 命令
  │   │   └── 动态发现的 skills
  │   ├── getTools()                     ← 组装工具注册表
  │   │   ├── getAllBaseTools()          ← 核心工具（按 feature flag 条件包含）
  │   │   ├── filterToolsByDenyRules()   ← 权限黑名单过滤
  │   │   └── isEnabled() 检查           ← 运行时启用检查
  │   ├── initBundledSkills()            ← 内置技能
  │   └── initBuiltinPlugins()           ← 内置插件
  ├── IDE Bridge / REPL Bridge 初始化（可选）
  └── renderAndRun(AppStateProvider → REPL)
       └── launchRepl()                  ← 启动 Ink TUI 主循环
```

### 三、三大注册器（程序骨架）

程序的核心能力由三个注册器提供，均在启动阶段加载完成：

| 注册器 | 源文件 | 加载来源 | 说明 |
|--------|--------|----------|------|
| **Commands** | [src/commands.ts](src/commands.ts) | 内置 + Skills目录 + Plugin + 动态发现 | ~80+ 斜杠命令 |
| **Tools** | [src/tools.ts](src/tools.ts) | 内置 + MCP服务器 | ~50+ 工具，按 feature flag 条件包含 |
| **Skills** | [src/skills/](src/skills/) + [src/plugins/](src/plugins/) | Bundled + 用户目录 + Plugin | 通过 SkillTool 调用 |

重要特性：
- Commands 和 Tools 都使用 `feature()` 做**编译期死代码消除（DCE）**——特定功能的代码在构建时按 flag 和 `USER_TYPE` 移除
- Skills 分为三个来源：`bundled`（内置打包）、skills 目录（用户自定义 `SKILL.md`）、`plugin`（插件提供）
- 工具也来自 MCP 服务器——通过 `assembleToolPool()` 合并内置工具与 MCP 工具（内置优先去重）

### 四、REPL 主循环（用户输入 → 模型响应）

```
用户输入
  │
  ▼
REPL.tsx: handlePromptSubmit()
  │  检查输入是否为斜杠命令
  ├── 是 → findCommand() → command.invoke() → 显示结果 → 等待下次输入
  │
  └── 否（普通消息）→ 进入查询循环
       │
       ▼
  context.ts  收集上下文
  ├── getSystemContext()
  │   ├── CLAUDE.md 项目指令文件
  │   ├── Git 状态（分支、最近提交、变更文件）
  │   ├── 记忆文件（~/.claude/memory/）
  │   └── 平台信息（OS、Shell、日期）
  └── getUserContext()
      ├── 项目目录结构
      └── 环境变量
       │
       ▼
  query.ts: query() → queryLoop()
  ┌──────────────────────────────────────────────────┐
  │  while (true) {                                   │
  │    ├── 构造消息列表（含压缩边界处理）                │
  │    │                                             │
  │    ├── POST /v1/messages（流式 SSE）              │
  │    │                                             │
  │    ├── 流式响应处理                                │
  │    │   ├── text_delta  → 渐进渲染到终端            │
  │    │   ├── thinking_delta → 思考过程（可选显示）    │
  │    │   └── tool_use 块 → 进入工具调用流程          │
  │    │                                             │
  │    ├── 工具调用流程（每个 tool_use 块）             │
  │    │   ├── findToolByName() → 查找工具             │
  │    │   ├── 权限检查（详见第五节）                   │
  │    │   │   ├── bypassPermissions → 直接执行        │
  │    │   │   ├── plan 模式 → Plan 审批              │
  │    │   │   ├── auto 模式 → 自动放行安全操作         │
  │    │   │   └── default → 匹配规则/弹出权限对话框    │
  │    │   ├── tool.invoke(input, context)            │
  │    │   └── 结果作为 tool_result 返回 API 继续循环   │
  │    │                                             │
  │    ├── Token 阈值触发                              │
  │    │   ├── 触发条件：剩余上下文窗口不足             │
  │    │   ├── autoCompact → 自动压缩                  │
  │    │   └── reactiveCompact → 响应式压缩             │
  │    │                                             │
  │    ├── stop_reason: end_turn → 当前轮完成          │
  │    └── stop_reason: max_tokens → 自动继续          │
  │  }                                               │
  └──────────────────────────────────────────────────┘
       │
       ▼
  记录会话（transcript + cost + usage）
  生成会话标题 → 等待下一次用户输入
```

### 五、权限系统（每次工具调用必经之路）

```
canUseTool(tool, args, context)
  │
  ├── Step 1a: 匹配 deny 规则（黑名单优先）
  │   └── 命中 → 直接拒绝，不弹窗，记录拒绝
  │
  ├── Step 1b: 匹配 allow 规则（白名单）
  │   └── 命中 → 直接允许
  │
  ├── Step 2: Bash 分类器（危险模式检测）
  │   └── 检测到危险命令模式 → 标记需用户审批
  │
  └── Step 3: 无规则匹配 → 弹出权限对话框（组件在 components/permissions/）
      ├── 允许一次   → 执行
      ├── 始终允许   → 写入 allowlist 规则 → 执行
      └── 拒绝       → 记录拒绝 → 返回错误
```

四种权限模式：`default`（交互弹窗）、`plan`（Plan 模式审批）、`bypassPermissions`（全部放行）、`auto`（自动放行已分类为安全的操作）。

### 六、Feature Flags 体系

使用 Bun 的 `bun:bundle` 实现**编译期死代码消除**，而非运行时检查：

```typescript
import { feature } from 'bun:bundle'

// feature('VOICE_MODE') 在构建时被替换为 true 或 false
// false 时整个 if 块从产物中删除，零运行时开销
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default  // 仅 flag=true 时保留
  : null
```

这确保：
- 外部构建（非 Anthropic 内部）**不含**任何内部工具代码
- 按需包含可选功能（Bridge、Daemon、Cron、Voice 等）
- 二进制体积最小化

### 七、整体数据流

```
CLI args → cli.tsx（路由分发）
              │
              ▼
         main.tsx（初始化 + 三大注册器加载 + REPL 渲染）
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
Commands   Tools     Skills
 (80+)     (50+)    (bundled/dir/plugin)
    │         │         │
    └─────────┼─────────┘
              ▼
         REPL.tsx（Ink TUI 主循环）
              │
        用户输入处理
              │
              ▼
     query.ts: queryLoop()
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
context.ts  Anthropic  权限系统
(Git/MD/)    API      (hooks/)
    └─────────┼──────────┘
              ▼
         工具执行 → 结果返回 API → 循环
              │
              ▼
         结果渲染 → 等待下次输入
```

---

## Core Architecture

### 1. Tool System (`src/tools/`)

Every tool Claude Code can invoke is implemented as a self-contained module. Each tool defines its input schema, permission model, and execution logic.

| Tool | Description |
|---|---|
| `BashTool` | Shell command execution |
| `FileReadTool` | File reading (images, PDFs, notebooks) |
| `FileWriteTool` | File creation / overwrite |
| `FileEditTool` | Partial file modification (string replacement) |
| `GlobTool` | File pattern matching search |
| `GrepTool` | ripgrep-based content search |
| `WebFetchTool` | Fetch URL content |
| `WebSearchTool` | Web search |
| `AgentTool` | Sub-agent spawning |
| `SkillTool` | Skill execution |
| `MCPTool` | MCP server tool invocation |
| `LSPTool` | Language Server Protocol integration |
| `NotebookEditTool` | Jupyter notebook editing |
| `TaskCreateTool` / `TaskUpdateTool` | Task creation and management |
| `SendMessageTool` | Inter-agent messaging |
| `TeamCreateTool` / `TeamDeleteTool` | Team agent management |
| `EnterPlanModeTool` / `ExitPlanModeTool` | Plan mode toggle |
| `EnterWorktreeTool` / `ExitWorktreeTool` | Git worktree isolation |
| `ToolSearchTool` | Deferred tool discovery |
| `CronCreateTool` | Scheduled trigger creation |
| `RemoteTriggerTool` | Remote trigger |
| `SleepTool` | Proactive mode wait |
| `SyntheticOutputTool` | Structured output generation |

### 2. Command System (`src/commands/`)

User-facing slash commands invoked with `/` prefix.

| Command | Description |
|---|---|
| `/commit` | Create a git commit |
| `/review` | Code review |
| `/compact` | Context compression |
| `/mcp` | MCP server management |
| `/config` | Settings management |
| `/doctor` | Environment diagnostics |
| `/login` / `/logout` | Authentication |
| `/memory` | Persistent memory management |
| `/skills` | Skill management |
| `/tasks` | Task management |
| `/vim` | Vim mode toggle |
| `/diff` | View changes |
| `/cost` | Check usage cost |
| `/theme` | Change theme |
| `/context` | Context visualization |
| `/pr_comments` | View PR comments |
| `/resume` | Restore previous session |
| `/share` | Share session |
| `/desktop` | Desktop app handoff |
| `/mobile` | Mobile app handoff |

### 3. Service Layer (`src/services/`)

| Service | Description |
|---|---|
| `api/` | Anthropic API client, file API, bootstrap |
| `mcp/` | Model Context Protocol server connection and management |
| `oauth/` | OAuth 2.0 authentication flow |
| `lsp/` | Language Server Protocol manager |
| `analytics/` | GrowthBook-based feature flags and analytics |
| `plugins/` | Plugin loader |
| `compact/` | Conversation context compression |
| `policyLimits/` | Organization policy limits |
| `remoteManagedSettings/` | Remote managed settings |
| `extractMemories/` | Automatic memory extraction |
| `tokenEstimation.ts` | Token count estimation |
| `teamMemorySync/` | Team memory synchronization |

### 4. Bridge System (`src/bridge/`)

A bidirectional communication layer connecting IDE extensions (VS Code, JetBrains) with the Claude Code CLI.

- `bridgeMain.ts` — Bridge main loop
- `bridgeMessaging.ts` — Message protocol
- `bridgePermissionCallbacks.ts` — Permission callbacks
- `replBridge.ts` — REPL session bridge
- `jwtUtils.ts` — JWT-based authentication
- `sessionRunner.ts` — Session execution management

### 5. Permission System (`src/hooks/toolPermission/`)

Checks permissions on every tool invocation. Either prompts the user for approval/denial or automatically resolves based on the configured permission mode (`default`, `plan`, `bypassPermissions`, `auto`, etc.).

### 6. Feature Flags

Dead code elimination via Bun's `bun:bundle` feature flags:

```typescript
import { feature } from 'bun:bundle'

// Inactive code is completely stripped at build time
const voiceCommand = feature('VOICE_MODE')
  ? require('./commands/voice/index.js').default
  : null
```

Notable flags: `PROACTIVE`, `KAIROS`, `BRIDGE_MODE`, `DAEMON`, `VOICE_MODE`, `AGENT_TRIGGERS`, `MONITOR_TOOL`

---

## Key Files in Detail

### `query.ts` (~1,500 lines)

The core query loop that drives the agentic conversation. Handles: message construction, Anthropic API streaming (SSE), tool-call dispatch → permission check → execution → result collection, automatic context compaction (autoCompact / reactiveCompact), max-token continuation, and interleaved thinking. Uses a `while (true)` loop with mutable state to support multi-turn tool calling within a single user message.

### `entrypoints/cli.tsx` (~280 lines)

Bootstrap entrypoint with fast-path routing. Checks for special flags (`--version`, `--dump-system-prompt`, `--daemon-worker`, `remote-control`, `daemon`, `ps/logs/attach/kill`, etc.) and conditionally loads only the modules needed for each path. Falls through to `main.tsx` when no special flags match.

### `main.tsx` (~780K, ~15,000 lines)

Full CLI startup orchestration: parallel initialization (MDM, keychain, GrowthBook), config migrations (11 historical migration steps), Commander.js CLI argument parsing, bootstrap data loading (commands, tools, skills, plugins), IDE Bridge setup, and REPL launch via Ink renderer.

### `commands.ts` (~700 lines)

Command registry: loads all slash commands from multiple sources (built-in, skills directories, plugins, dynamic discovery), filters by availability/auth requirements, deduplicates, and provides lookup functions. Exports `getCommands()`, `getSkillToolCommands()`, `getSlashCommandToolSkills()`.

### `tools.ts` (~390 lines)

Tool registry: assembles all agent-callable tools via `getAllBaseTools()`, filters by permission deny rules, handles REPL-mode tool substitution, and merges built-in tools with MCP server tools via `assembleToolPool()`.

### `context.ts` (~200 lines)

Collects system and user context for the LLM: reads `CLAUDE.md` / `GEMINI.md` / `AGENTS.md` project instructions, collects git status (branch, recent commits, working tree), loads memory files, and gathers platform/environment information.

---

## Tech Stack

| Category | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| Terminal UI | [React](https://react.dev) + [Ink](https://github.com/vadimdemedes/ink) |
| CLI Parsing | [Commander.js](https://github.com/tj/commander.js) (extra-typings) |
| Schema Validation | [Zod v4](https://zod.dev) |
| Code Search | [ripgrep](https://github.com/BurntSushi/ripgrep) (via GrepTool) |
| Protocols | [MCP SDK](https://modelcontextprotocol.io), LSP |
| API | [Anthropic SDK](https://docs.anthropic.com) |
| Telemetry | OpenTelemetry + gRPC |
| Feature Flags | GrowthBook |
| Auth | OAuth 2.0, JWT, macOS Keychain |

---

## Notable Design Patterns

### 启动并行化

启动时三项操作并行执行以减少延迟：

```typescript
// main.tsx — 在模块导入完成前即作为副作用启动
profileCheckpoint('main_tsx_entry')
startMdmRawRead()        // MDM 配置子进程（plutil / reg query）
startKeychainPrefetch()  // macOS Keychain 凭证预取
```

### 模块懒加载

重型模块延迟加载，仅在需要时 `import()`：OpenTelemetry ~400KB、gRPC ~700KB 延迟到遥测首次使用时加载；Insights（113KB / 3200 行）延迟到 `/insights` 命令首次调用时加载。

### Agent 并行（Swarm）

子 Agent 通过 `AgentTool` 生成，`coordinator/` 处理多 Agent 编排。`TeamCreateTool` / `TeamDeleteTool` 实现团队级并行工作。子 Agent 之间通过 `SendMessageTool` 通信。

### 自定义 Ink 渲染器

`src/ink/` 包含约 50 个文件的定制 Ink fork：自有 reconciler、DOM、布局引擎、虚拟滚动、文本换行、bidi 支持。

### 权限系统架构

`src/hooks/toolPermission/` 中的所有内容：每次工具调用均执行权限检查。使用 Bash/Shell 分类器进行危险模式检测。权限规则通过 allowlist/denylist 持久化。模式：`default`（交互弹窗）、`plan`（Plan 模式审批）、`bypassPermissions`（全部放行）、`auto`（自动放行安全操作）。

---

## Disclaimer

This repository archives source code that was leaked from Anthropic's npm registry on **2026-03-31**. All original source code is the property of [Anthropic](https://www.anthropic.com).
