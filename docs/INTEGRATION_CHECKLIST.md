# Refactoring Integration Checklist

This checklist tracks the migration from V1 (demo-grade) to V2 (production-grade) components.

## ✅ New Components Created

- [x] Enhanced types (`shared/types.ts`)
  - ExecutionContext with full lifecycle
  - ExecutionEvent for tracing
  - ProviderResponse normalization
  - PolicyDecision schema

- [x] ExecutionTracer (`coordinator/ExecutionTracer.ts`)
  - Structured event emission
  - Debug mode support
  - 15+ event types

- [x] Enhanced ExecutionContext factory
  - Session persistence
  - Trace correlation
  - Parent-child linking
  - Child context helpers

- [x] CoordinatorV2 (`coordinator/CoordinatorV2.ts`)
  - Timeout enforcement
  - Exponential backoff retry
  - Cost tracking
  - Full tracing integration
  - Error normalization

- [x] Enhanced PolicyEngine (`policy/PolicyEngine.ts`)
  - Multi-factor decision logic
  - Health check caching
  - Cost budget checking
  - Sensitivity-based routing

- [x] PolicySchema extensions (`policy/PolicySchema.ts`)
  - Task type definitions
  - Sensitivity levels
  - Detailed cost controls
  - Routing policies

- [x] ProviderGatewayV2 (`providers/ProviderGatewayV2.ts`)
  - Timeout support (AbortController)
  - Error normalization
  - Standardized response schema
  - Token estimation

- [x] ToolExecutorV2 (`tools/ToolExecutorV2.ts`)
  - Input validation
  - Tool name validation
  - Size limit enforcement
  - Timeout per tool

- [x] SecureShellTool (`tools/shell/SecureShellTool.ts`)
  - Command whitelisting
  - Dangerous pattern detection
  - Safe execution only

- [x] SkillExecutorV2 (`skills/SkillExecutorV2.ts`)
  - Skill composition support
  - Circular call detection
  - Timeout enforcement
  - Child context linking

- [x] debugErrorSkillV2 (`skills/builtins/debugErrorSkillV2.ts`)
  - Real multi-step workflow example
  - File reading + analysis + fixes
  - Error parsing and context

- [x] AgentPlannerV2 (`agents/AgentPlannerV2.ts`)
  - LLM-based planning
  - Fallback to keyword matching
  - Plan result evaluation
  - Structured AgentPlan output

## ⏳ Pending: Bootstrap Integration

### Phase 1: Imports & Wiring
- [ ] Import all V2 components in `bootstrap.ts`
- [ ] Keep V1 imports for backward compatibility
- [ ] Initialize PolicyEngine with ProviderRegistry

```typescript
// OLD
import { PolicyEngine } from './policy/PolicyEngine.js'
const policy = new PolicyEngine(config.policy)

// NEW (in addition)
import { PolicyEngine } from './policy/PolicyEngine.js'  // Still works
const policy = new PolicyEngine(providerRegistry, config.policy)  // Enhanced
```

### Phase 2: Provider Wiring
- [ ] Replace ProviderGateway with ProviderGatewayV2
- [ ] Test backward compat of `.generate()` method
- [ ] Verify error normalization in providers

```typescript
// OLD → NEW
import { ProviderGateway } from './providers/ProviderGateway.js'
// ↓
import { ProviderGatewayV2 } from './providers/ProviderGatewayV2.js'

const gateway = new ProviderGatewayV2(providerRegistry, selector)
```

### Phase 3: Tool & Skill Wiring
- [ ] Replace ToolExecutor with ToolExecutorV2
- [ ] Wire SecureShellTool instead of ShellTool
- [ ] Replace SkillExecutor with SkillExecutorV2
- [ ] Register debugErrorSkillV2 alongside v1 skills

```typescript
// OLD → NEW
import { ShellTool } from './tools/shell/ShellTool.js'
// ↓
import { SecureShellTool } from './tools/shell/SecureShellTool.js'

toolRegistry.register(SecureShellTool)

// OLD → NEW
import { Coordinator } from './coordinator/Coordinator.js'
// ↓
import { CoordinatorV2 } from './coordinator/CoordinatorV2.ts'
```

### Phase 4: Coordinator Migration
- [ ] Replace Coordinator with CoordinatorV2
- [ ] Pass debugMode flag from config
- [ ] Update agent engine to use V2 traits
- [ ] Test full execution flow

```typescript
// OLD
const coordinator = new Coordinator({ providerGateway, policy, runAgent })

// NEW
const coordinator = new CoordinatorV2(
  { providerGateway, policy, runAgent },
  config.debug ?? false
)
```

### Phase 5: Command Handler Updates
- [ ] Update `registerCommands.ts` to use new context factory
- [ ] Add `--debug` flag to CLI commands
- [ ] Test chat command end-to-end
- [ ] Test agent command end-to-end
- [ ] Test skill command end-to-end

```typescript
// OLD
const context = createExecutionContext('chat', 'auto')

// NEW (with debug support)
const context = createExecutionContext('chat', 'auto', {
  debug: options.debug ?? false
})
```

- [ ] Verify provider selection logic works
- [ ] Verify retry on transient failures
- [ ] Verify timeout stops hanging requests
- [ ] Verify cost tracking updates sessionId
- [ ] Verify tracing events emit to stderr (debug mode)

### Phase 6: Testing
- [ ] Unit: CoordinatorV2 timeout logic
- [ ] Unit: PolicyEngine multi-factor decisions
- [ ] Unit: Error normalization
- [ ] Unit: Shell tool whitelisting
- [ ] Integration: Chat with local provider
- [ ] Integration: Chat with remote provider fallback
- [ ] Integration: Agent planning and execution
- [ ] Integration: Full session cost tracking

### Phase 7: Backward Compatibility
- [ ] Keep old Coordinator.ts (deprecated)
- [ ] Keep old ToolExecutor.ts (deprecated)
- [ ] Keep old SkillExecutor.ts (deprecated)
- [ ] Keep old AgentPlanner.ts (deprecated)
- [ ] Update types to mark as deprecated
- [ ] Document deprecation timeline

### Phase 8: Documentation
- [ ] Update README with new capability matrix
- [ ] Add architecture diagram showing V2 flows
- [ ] Create upgrade guide for users
- [ ] Document new config options
- [ ] Create observability guide (tracing, debug mode)

## Test Scenarios

### Basic Flow
- [ ] `imrabo chat "hello"` completes successfully
- [ ] Response appears in 0-30s (timeout works)
- [ ] Debug mode shows execution events

### Timeout & Retry
- [ ] Unresponsive provider triggers timeout
- [ ] Transient error triggers retry
- [ ] Max retries exceeded → error
- [ ] Exponential backoff visible in timing

### Cost Tracking
- [ ] Session cost increments per request
- [ ] Budget exceeded → error
- [ ] Cost resets per session

### Error Handling
- [ ] Network error → retriable code
- [ ] 401 auth error → non-retriable
- [ ] 429 rate limit → retriable, respects backoff
- [ ] Timeout → normalized to TIMEOUT code

### Security
- [ ] Shell tool whitelist enforced
- [ ] Shell tool dangerous patterns blocked
- [ ] File tool path traversal blocked
- [ ] Permission checks called

### Skills & Agents
- [ ] debugErrorSkillV2 reads files + analyzes
- [ ] Skill composition works (skill calls skill)
- [ ] Circular skill call detected
- [ ] Agent uses LLM planning (or fallback)

## Configuration Changes

**New in `policy`:**
```javascript
// Before
{
  defaultProvider: 'local',
  fallbackProvider: 'remote',
  allowFallback: true,
  maxCost: 'low',
  maxRetries: 2
}

// After (backward compatible + new)
{
  defaultProvider: 'auto',                    // NEW
  maxCost: 'low',
  maxSessionCost: 10.00,                      // NEW
  maxDailyCost: 100.00,                       // NEW
  defaultTimeoutMs: 30000,                    // NEW
  maxTimeoutMs: 120000,                       // NEW
  enableFallback: true,                       // NEW
  enableRetry: true,                          // NEW
  useExponentialBackoff: true,                // NEW
  dangerousToolsAllowed: false,               // NEW
  requireApprovalForShell: true,              // NEW
  preferLocalForCode: true,                   // NEW
  preferRemoteForReasoning: false,            // NEW
  useHealthChecks: true,                      // NEW
  healthCheckCacheTtlMs: 5000,                // NEW
  sensitivityRouting: {...}                   // NEW
}
```

## Rollback Plan

If V2 causes issues:

1. Keep V1 components in repo (don't delete)
2. Revert `bootstrap.ts` imports to V1
3. Remove V2 from package bundles
4. Roll back CLI version

## Success Metrics

- [ ] All timeouts trigger within ±5% of configured value
- [ ] Retry backoff follows exponential curve (1s → 2s → 4s...)
- [ ] Cost estimates within 50% of actual (acceptable for budgeting)
- [ ] No provider calls take >maxTimeoutMs
- [ ] No cli  hangs (all operations have timeouts)
- [ ] Error messages meaningful (not raw HTTP status)
- [ ] Shell commands restricted to whitelist
- [ ] File reads stay within cwd
- [ ] Debug mode < 100ms overhead per event

---

**Checklist Owner:** Architect  
**Target Completion:** 1 week  
**Dependencies:** None (self-contained)  
**Risk Level:** Low (V2 is new, V1 unchanged for fallback)
