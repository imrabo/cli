# imrabo Unified CLI Architecture

## 1. Final Architecture

Execution chain:

CLI -> Command Router -> Coordinator -> Agent -> Skill -> Tool -> Provider Gateway -> HTTP Providers

Key enforcement rules:

- Coordinator is the only model-execution gateway.
- Skills cannot call providers directly.
- Tools are stateless and side-effect scoped.
- Providers are HTTP-only (local or remote).
- No daemon/runtime lifecycle is controlled by CLI.

## 2. Folder Structure

Implemented in `cli/src`:

- `commands/` grouped command registration for chat/agent/skill/tool/model/provider/plugin/auth/doctor/config
- `coordinator/` centralized routing and execution control
- `policy/` provider and fallback policy
- `providers/` strict provider abstraction + local and remote HTTP implementations
- `agents/` planning and iterative skill execution
- `skills/` interface, registry, executor, built-in skills
- `tools/` stateless tool contracts and permission gateway
- `auth/` browser/device-style login flow and token persistence
- `memory/` session + persistent memory primitives
- `plugins/` capability-based plugin host and manifest contract
- `ui/` Ink-based rendering component
- `cli/` interactive and non-interactive chat entrypoints

## 3. Command System

Command groups:

- `imrabo chat`
- `imrabo agent`
- `imrabo skill`
- `imrabo tool`
- `imrabo model`
- `imrabo provider`
- `imrabo plugin`
- `imrabo login`
- `imrabo auth`
- `imrabo doctor`
- `imrabo config`

Skill-specific required commands:

- `imrabo skill list`
- `imrabo skill describe <name>`
- `imrabo skill run <name>`

## 4. Provider Design

Provider interface:

- `name: string`
- `generate(input): AsyncIterable<ResponseChunk>`
- `models(): Promise<Model[]>`
- `health(): Promise<Status>`

Implemented providers:

- Local HTTP:
  - `OllamaProvider`
  - `LMStudioProvider`
  - `GenericLocalHttpProvider`
- Remote HTTP:
  - `OpenAIProvider`
  - `GenericHttpProvider`

Routing behavior:

- explicit provider flag wins when valid
- auto mode prefers healthy local providers
- fallback to remote when policy allows

## 5. Execution Flow

- User command enters Commander CLI.
- Command router maps command to operation.
- Coordinator receives operation and context.
- Agent mode plans with skills.
- Skill executor orchestrates tools.
- Model requests from skills are sent to coordinator.
- Coordinator uses policy + provider selector.
- Provider gateway streams response over HTTP.
- Response is surfaced via CLI/Ink UI.

## 6. Removed Components

Removed from active CLI path:

- runtime daemon start/stop/restart lifecycle commands
- local process and PID lock assumptions
- CLI-controlled model lifecycle orchestration

Legacy utility files related to runtime lifecycle were removed from `cli/src/utils`.

## 7. Risks and Limitations

- Provider payload formats differ across APIs and may require endpoint-specific adapters.
- Current fallback policy is basic and should be expanded with circuit-breaker windows.
- Skill planner is heuristic and should be replaced by policy-aware planner logic.
- Interactive UI is minimal Ink rendering; richer tool-step visualization needs additional components.
- Plugin loading is manifest-first and does not yet sandbox untrusted execution.

## 8. Future Extension

Add a provider plugin named `ImraboRuntimeProvider` later, but only as another `ModelProvider` implementation behind Provider Gateway.

Constraints for future provider:

- must remain HTTP boundary based
- cannot bypass coordinator or policy engine
- must not introduce CLI-managed daemon lifecycle semantics

## Skills Architecture

Layering:

Agent -> Skill -> Tool -> Coordinator -> Provider

Skill contract:

- `name`
- `description`
- `tags`
- `execute(input, context)`

Skill rules:

- stateless execution
- reusable and composable
- model calls only through coordinator
- side-effects only through tools

Skill registry supports:

- built-in skills
- plugin skills
- optional MCP-linked skills

Built-in skills scaffolded:

- `code_review_skill`
- `debug_error_skill`
- `generate_api_skill`
- `refactor_code_skill`
- `analyze_logs_skill`
- `write_tests_skill`
