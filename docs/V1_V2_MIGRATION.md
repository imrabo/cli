# V1 ↔ V2 Migration Quick Reference

Quick cheat sheet for migrating from demo-grade (V1) to production (V2) components.

---

## Types & Contracts

| Aspect | V1 | V2 | Notes |
|--------|----|----|-------|
| ExecutionContext | Minimal | Full lifecycle | Add: executionId, status, timing, cost, error |
| ExecutionEvent | None | NEW | 15+ event types for tracing |
| ProviderResponse | AsyncIterable | Normalized | Standard: content, tokens, latency, error |
| PolicyConfig | 4 fields | 18+ fields | Add: timeout, cost controls, sensitivity routing |
| PolicyDecision | None | NEW | Structure: reason, timeout, allowFallback, etc |

---

## Coordinator Layer

| Responsibility | V1 | V2 | Breaking? |
|---|---|---|---|
| Model request | `requestModel()` | `requestModel()` | No (enhanced) |
| Chat routing | `chat()` | `chat()` | No |
| Agent execution | `executeAgent()` | `executeAgent()` | No |
| Route selection | `routeChat()` | `routeChat()` | No |
| **Timeout** | ❌ None | ✅ 30s default | YES (fixed bug) |
| **Retry** | ❌ None | ✅ Exponential | YES (fixed bug) |
| **Cost tracking** | ❌ None | ✅ Per-session | YES (new feature) |
| **Tracing** | ❌ String logs | ✅ Events | YES (better) |
| **Error handling** | ❌ Raw exceptions | ✅ Normalized | YES (better) |

**Migration:**
```typescript
// V1
import { Coordinator } from './Coordinator'
const c = new Coordinator({ providerGateway, policy, runAgent })

// V2
import { CoordinatorV2 } from './CoordinatorV2'
const c = new CoordinatorV2({ providerGateway, policy, runAgent }, debugMode)
```

---

## Policy Engine

| Decision | V1 | V2 | Method |
|---|---|---|---|
| Provider selection | Simple `resolveDefaultProvider()` | `evaluate()` async | Multi-factor |
| Fallback check | `shouldFallback()` | Included in decision | Automatic |
| Max retries | `getMaxRetries()` | Endpoint on Policy, used in Coordinator | Automatic |
| Cost check | ❌ None | `checkCostBudget()` | ✅ New |
| Retry backoff | ❌ None | `getRetryBackoff()` | ✅ Exponential |
| Provider health | ❌ During select | ✅ Cached | 5s TTL |

**Migration:**
```typescript
// V1
const policy = new PolicyEngine(config.policy)
const provider = policy.resolveDefaultProvider('auto')

// V2
const policy = new PolicyEngine(providerRegistry, config.policy)
const decision = await policy.evaluate(context)
const { providerName, timeout } = decision
```

---

## Provider Gateway

| Feature | V1 | V2 | Impact |
|---|---|---|---|
| Provider selection | `select()` then call | Built-in | Simpler |
| Stream chunks | ✅ Yes | ✅ Yes | No change |
| **Timeout** | ❌ None | ✅ AbortController | Hangs → Fixed |
| **Error norm.** | ❌ Raw HTTP | ✅ Standard codes | Better errors |
| **Response format** | AsyncIterable | Normalized object | YES (breaking) |
| **Latency tracking** | ❌ None | ✅ In response | Debug visibility |

**Migration:**
```typescript
// V1
for await (const chunk of gateway.generate(req, 'auto')) {
  process.stdout.write(chunk.text)
}

// V2 (recommended)
const response = await gateway.generateWithNormalization(req, 'auto', 30000)
console.log(response.content)
console.log(response.latencyMs, 'ms')
```

---

## Tool Executor

| Aspect | V1 | V2 | Security |
|---|---|---|---|
| Validation | ❌ None | ✅ 3-part | Input validation |
| Size limits | ❌ None | ✅ 10MB max | DoS protection |
| Whitelisting | ❌ None | ✅ Shell only | Exec safety |
| Timeout | ❌ None | ✅ 10s per tool | Resource limits |
| Error handling | Exception | Caught, typed | Better errors |

**Migration:**
```typescript
// V1
const result = await executor.run('shell.exec', input, context)

// V2 (safe)
const result = await executor.run('shell.exec', input, context, {
  timeout: 10_000
})
// Throws on:
// - Validation failure
// - Permission denied
// - Timeout
// - Output too large
```

---

## Tool Implementations

| Tool | V1 | V2 | Security |
|---|---|---|---|
| FileReadTool | Raw file read | ✅ Path checks | Traversal blocked |
| ShellTool | Raw exec | ❌ Deprecated | UNSAFE |
| SecureShellTool | NEW | ✅ Whitelist | Injection blocked |
| WebFetchTool | No limit | ✅ 4KB limit | SSRF risk mitigated |
| McpTool | Stub | Stub | Unchanged |

**Shell Migration (CRITICAL):**
```typescript
// V1 (DANGEROUS)
toolRegistry.register(ShellTool)  // Raw exec → no safety

// V2 (SAFE)
toolRegistry.register(SecureShellTool)  // Whitelist enforced
// Allowed: npm, node, python, git, cat, find, etc.
// Blocked: rm, sudo, exec patterns
```

---

## Skill Executor

| Feature | V1 | V2 | Impact |
|---|---|---|---|
| Tool calling | ✅ Yes | ✅ Yes | No change |
| Model asking | ✅ Yes | ✅ Yes | No change |
| **Skill composition** | ❌ No | ✅ callSkill() | YES (new) |
| **Circular detection** | ❌ None | ✅ Stack trace | YES (safety) |
| **Timeout** | ❌ None | ✅ 60s default | YES (safety) |
| **Error handling** | Exception | Caught | Better |

**Migration:**
```typescript
// V1
const result = await executor.execute('code_review', input, context)

// V2 (with composition support)
const result = await executor.execute('debug_error_skill', input, context, {
  timeout: 60_000
})

// Inside skill: can now call other skills!
const fooResult = await context.callSkill('other_skill', data)
```

---

## Skills

| Pattern | V1 | V2 | Reusability |
|---|---|---|---|
| Single LLM call | ✅ (6 skills) | Still works | Limited |
| Multi-step workflows | ❌ Not possible | ✅ YES | debugErrorSkillV2 example |
| Tool integration | ❌ Manual | ✅ Via context | First-class |
| Error handling | Exception | Try-catch | Better |
| Composability | ❌ No | ✅ YES | Chains possible |

**Example (V1 → V2):**
```typescript
// V1 (just prompt)
export const codeReviewSkill = {
  async execute(input, context) {
    const response = await context.askModel(`Review: ${input}`)
    return { summary: response }
  }
}

// V2 (real workflow)
export const debugErrorSkillV2 = {
  async execute(input, context) {
    // Step 1: Parse error
    const { filename } = parseError(input)
    
    // Step 2: Read code (use tool)
    const code = await context.runTool('file.read', filename)
    
    // Step 3: Analyze (ask model with context)
    const analysis = await context.askModel(`Analyze:\n${code}`)
    
    // Step 4: Generate fixes (another model call)
    const fixes = await context.askModel(`Fixes:\n${analysis}`)
    
    // Step 5: Optional - call another skill
    const verification = await context.callSkill('write_tests_skill', fixes)
    
    return {
      summary: `${analysis}\n${fixes}`,
      data: { code, analysis, fixes },
      nextStep: 'apply_fixes'
    }
  }
}
```

---

## Agent Planner

| Aspect | V1 | V2 | Intelligence |
|---|---|---|---|
| Planning | Keyword matching | LLM-based | ✅ Smarter |
| Fallback | N/A | Keyword match | Safety |
| Reasoning | ❌ None | ✅ Included | Explainable |
| Plan format | Array of strings | Structured steps | Better |
| Adaptation | ❌ No | ✅ shouldReplan() | Iterative |

**Migration:**
```typescript
// V1
const steps = planner.plan('review code')
// Returns: ['code_review_skill', 'debug_error_skill']

// V2
const plan = await planner.plan('review code', context)
// Returns: {
//   steps: [
//     { order: 1, skillName: 'code_review_skill', reason: '...' },
//     { order: 2, skillName: 'debug_error_skill', reason: '...' }
//   ],
//   reasoning: 'LLM chose these steps because...'
// }
```

---

## ExecutionContext

| Aspect | V1 | V2 | Usage |
|---|---|---|---|
| sessionId | Created each call | Reused across turns | Multi-turn conversations |
| traceId | Created each call | Reused for correlation | End-to-end tracing |
| executionId | NEW | Unique per call | Span identification |
| parentExecutionId | NEW | Optional | Parent-child linking |
| status | NEW | pending/running/success/failure/timeout | Lifecycle tracking |
| startTime | NEW | timestamp | Duration calculation |
| endTime | NEW | timestamp | Latency measurement |
| providerUsed | NEW | 'ollama' | Audit trail |
| retriesAttempted | NEW | 0-3 | Debug info |
| costEstimate | NEW | cents | Budget tracking |
| tokensUsed | NEW | {input, output} | Resource tracking |
| error | NEW | {code, message, retriable} | Error context |
| debugEvents | NEW | ExecutionEvent[] | Full trace (when debug=true) |

**Migration:**
```typescript
// V1
const ctx = createExecutionContext('chat', 'auto')
// Minimal context

// V2 (enhanced, backward compat)
const ctx = createExecutionContext('chat', 'auto', {
  sessionId: existingId,           // Reuse for multi-turn
  debug: true                      // Enable tracing
})
// Now has full lifecycle metadata

// V2 (child context, for nested executions)
const childCtx = createChildExecutionContext(parentCtx, 'skill')
// Linked to parent, same session
```

---

## Configuration Changes

| Setting | V1 | V2 | Scope |
|---|---|---|---|
| `defaultProvider` | 'local' | 'auto' | SmartSelect |
| `maxCost` | 'low' | 'low' | Per-request |
| NEW: `maxSessionCost` | N/A | 10.00 | Per-session |
| NEW: `maxDailyCost` | N/A | 100.00 | Per-day |
| NEW: `defaultTimeoutMs` | N/A | 30000 | All requests |
| NEW: `maxTimeoutMs` | N/A | 120000 | Hard cap |
| `maxRetries` | 2 | 3 | Increased |
| NEW: `useExponentialBackoff` | N/A | true | Retry strategy |
| NEW: `dangerousToolsAllowed` | N/A | false | Security default |
| NEW: `requireApprovalForShell` | N/A | true | User confirmation |
| NEW: `preferLocalForCode` | N/A | true | Task-aware routing |
| NEW: `sensitivityRouting` | N/A | {…} | Data sovereignty |

**Example:**
```json
{
  "policy": {
    "defaultProvider": "auto",
    "maxCost": "low",
    "maxSessionCost": 10.00,
    "maxDailyCost": 100.00,
    "maxRetries": 3,
    "defaultTimeoutMs": 30000,
    "dangerousToolsAllowed": false,
    "requireApprovalForShell": true,
    "sensitivityRouting": {
      "private": "local-only",
      "sensitive": "approved-remote",
      "internal": "local-first",
      "public": "auto"
    }
  }
}
```

---

## Debug Mode

| Feature | V1 | V2 | Usage |
|---|---|---|---|
| Debug flag | N/A | ✅ debug=true | Enable tracing |
| Events | N/A | ✅ 15+ types | Full audit |
| Collection | N/A | ✅ In context | Access via debugEvents |
| Stderr output | N/A | ✅ JSON lines | Tail -f logs |

**Usage:**
```bash
# Enable debug mode
imrabo chat --debug "prompt"

# Or in code
const context = createExecutionContext('chat', 'auto', { debug: true })
await coordinator.requestModel(prompt, context)

# Output (to stderr):
{"type":"execution_started","executionId":"abc","timestamp":1712142000}
{"type":"provider_selected","executionId":"abc","details":{...}}
...
```

---

## Completeness Matrix

| Layer | V1 | V2 | Completeness |
|---|---|---|---|
| **Types** | 70% | 100% | Full lifecycle |
| **Coordinator** | 50% | 100% | Timeout, retry, cost, trace |
| **Policy** | 30% | 90% | Most decisions (sensitivity TBD) |
| **Provider** | 60% | 95% | Error norm, timeout (token ≈ still est.) |
| **Tools** | 50% | 100% | Validation, security |
| **Skills** | 40% | 100% | Composition, workflows |
| **Agents** | 30% | 80% | LLM planning (reflection TBD) |
| **Observability** | 10% | 80% | Tracing (logs/dashboard TBD) |

---

## Breaking Changes (Summary)

| Component | Breaking? | Migration Path |
|---|---|---|
| Coordinator | No (new class) | Keep V1, use V2 |
| PolicyEngine | Yes (signature) | Add `providerRegistry` param |
| ProviderGateway | No (method compat) | Use `generateWithNormalization()` |
| ToolExecutor | No (new class) | Keep V1, use V2 |
| SkillExecutor | No (new class) | Keep V1, use V2 |
| ShellTool | Yes (unsafe) | Migrate to SecureShellTool |
| AgentPlanner | No (new class) | Keep V1, use V2 |

---

## The Switchover (One Iteration)

1. **Update bootstrap.ts** (30 min)
   - Import V2 classes
   - Wire new dependencies
   - Initialize with config

2. **Update handlers** (30 min)
   - Add --debug flag
   - Use new context factory
   - Test one command

3. **Validate** (30 min)
   - Chat works
   - Timeout works
   - Cost tracking works
   - Tracing works

4. **Deploy**
   - Keep V1 as fallback
   - Monitor for issues
   - Gradual rollout

---

**Total Integration Time: ~2 hours**  
**Risk Level: LOW** (V1 unchanged, V2 is additive)  
**Rollback Time: 5 minutes** (revert bootstrap imports)
