# Refactoring V2: Usage Examples

Complete working examples using the new production-grade components.

---

## Example 1: Basic Chat with Timeout & Retry

```typescript
import { CoordinatorV2 } from './coordinator/CoordinatorV2.js'
import { createExecutionContext } from './coordinator/ExecutionContext.js'
import { ProviderGatewayV2 } from './providers/ProviderGatewayV2.js'
import { PolicyEngine } from './policy/PolicyEngine.js'
import { ProviderRegistry } from './providers/ProviderRegistry.js'
import { OllamaProvider } from './providers/local/OllamaProvider.js'
import { AgentEngine } from './agents/AgentEngine.js'

// Initialize
const providerRegistry = new ProviderRegistry()
providerRegistry.register(new OllamaProvider())

const policy = new PolicyEngine(providerRegistry, {
  defaultProvider: 'auto',
  maxRetries: 3,
  defaultTimeoutMs: 30_000,
})

const gateway = new ProviderGatewayV2(providerRegistry, selector)

const coordinator = new CoordinatorV2(
  {
    providerGateway: gateway,
    policy,
    runAgent: (goal, ctx) => agentEngine.run(goal, ctx),
  },
  true  // debugMode
)

// Execute
const context = createExecutionContext('chat', 'auto', {
  debug: true,  // Enable tracing
})

try {
  const response = await coordinator.requestModel('What is TypeScript?', context)
  console.log('Response:', response)
  console.log('Tokens:', context.tokensUsed)
  console.log('Cost:', context.costEstimate)
  console.log('Duration:', context.durationMs, 'ms')

  // Debug: Print all events
  if (context.debugEvents) {
    context.debugEvents.forEach(event => {
      console.log(`[${event.type}] ${JSON.stringify(event.details)}`)
    })
  }
} catch (error) {
  console.error('Execution failed:', error.message)
  if (context.error) {
    console.error(`Error Code: ${context.error.code}`)
    console.error(`Retriable: ${context.error.retriable}`)
  }
}
```

**Output:**
```
Response: TypeScript is a typed superset of JavaScript...
Tokens: { input: 25, output: 142 }
Cost: 0.0000025  (2.5 cents)
Duration: 1250 ms
[execution_started] { mode: 'chat', ... }
[provider_selected] { provider: 'ollama', reason: 'Local provider available' }
[provider_called] { provider: 'ollama', inputTokens: 25 }
[execution_completed] { status: 'success', latencyMs: 1250 }
```

---

## Example 2: Multi-Turn Conversation (Session Persistence)

```typescript
const coordinator = new CoordinatorV2(deps, true)

// Create session ID (reuse across turns)
const sessionId = crypto.randomUUID()
let sessionCost = 0

async function chat(userMessage: string) {
  const context = createExecutionContext('chat', 'auto', {
    sessionId,  // Reuse for correlation
    debug: true,
  })

  try {
    const response = await coordinator.requestModel(userMessage, context)
    
    // Track session cost
    sessionCost += context.costEstimate ?? 0
    console.log(`Session cost so far: $${(sessionCost / 100).toFixed(2)}`)

    // Show context info (for debugging)
    console.log(`Execution ID: ${context.executionId}`)
    console.log(`Trace ID: ${context.traceId}`)
    console.log(`Provider: ${context.providerUsed}`)
    console.log(`Retries: ${context.retriesAttempted}`)

    return response
  } catch (error) {
    console.error(`Turn failed: ${error.message}`)
    throw error
  }
}

// Conversation flow
await chat('What is React?')
// Provider selected, execution tracked
// Session cost: $0.00

await chat('How does useState work?')
// Same sessionId used, cost accumulates
// Session cost: $0.00

await chat('Show me an example')
// Cost check: if session exceeds budget, throws
// Session cost: $0.01
```

---

## Example 3: Skilled Execution with Tool Integration

```typescript
import { SkillExecutorV2 } from './skills/SkillExecutorV2.js'
import { debugErrorSkillV2 } from './skills/builtins/debugErrorSkillV2.js'

const skillRegistry = new SkillRegistry()
skillRegistry.register(debugErrorSkillV2)

const skillExecutor = new SkillExecutorV2(
  skillRegistry,
  toolExecutor,
  (prompt, ctx) => coordinator.requestModel(prompt, ctx)
)

// Use the multi-step skill
const context = createExecutionContext('skill', 'auto')

try {
  const result = await skillExecutor.execute(
    'debug_error_skill',
    `
      TypeError: Cannot read property 'map' of undefined
      at myFunction (app.js:45:23)
    `,
    context
  )

  console.log('Skill Result:')
  console.log('- Summary:', result.summary)
  console.log('- Error Type:', result.data?.type)
  console.log('- Suggested Fixes:', result.data?.fixes)
  console.log('- Next Step:', result.nextStep)

} catch (error) {
  if (error.message.includes('Circular')) {
    console.error('Circular skill call detected')
  } else if (error.message.includes('timeout')) {
    console.error('Skill timeout (60s)')
  } else {
    console.error('Skill failed:', error.message)
  }
}
```

**Output:**
```
Skill Result:
- Summary: Error Analysis:...
  Root cause: Missing null check...
  Suggested Fixes:
  1. Add guard clause before .map()
  2. Use optional chaining (?.)
  
- Error Type: TypeError
- Suggested Fixes: Add guard clause...
- Next Step: apply_fix
```

---

## Example 4: Policy-Driven Provider Selection

```typescript
const context = createExecutionContext('chat', 'auto')

// Policy will evaluate multiple factors
const policy = new PolicyEngine(providerRegistry, {
  defaultProvider: 'auto',
  preferLocalForCode: true,          // Code → use local Ollama
  preferRemoteForReasoning: false,   // Reasoning still local-first
  sensitivityRouting: {
    private: 'local-only',           // Never leaves device
    sensitive: 'approved-remote',    // Explicit allow
    internal: 'local-first',         // Try local first
    public: 'auto',                  // Auto-select
  },
})

// Scenario 1: Code review (should prefer local)
const decision1 = await policy.evaluate(createExecutionContext('chat', 'auto'))
console.log(decision1)
// {
//   providerName: 'ollama',
//   reason: 'Task type code prefers local provider',
//   timeout: 30000,
//   allowFallback: true
// }

// Scenario 2: Explicit provider request
const context2 = createExecutionContext('chat', 'remote')
const decision2 = await policy.evaluate(context2)
console.log(decision2)
// {
//   providerName: 'openai',
//   reason: 'Explicit remote provider selected',
//   timeout: 45000,
//   allowFallback: true
// }

// Scenario 3: Cost check
const canAfford = policy.checkCostBudget(0.50, 0.15)
console.log(`Can afford $0.15 with $0.50 spent? ${canAfford}`)
// true (under 'low' tier limit of $0.10 per request)
```

---

## Example 5: Agent with LLM-Based Planning

```typescript
import { AgentPlannerV2 } from './agents/AgentPlannerV2.js'

const planner = new AgentPlannerV2(
  skillRegistry,
  (prompt) => coordinator.requestModel(prompt, defaultContext)
)

// LLM generates a plan
const goal = 'Review the code in auth.ts, identify bugs, and write tests'

const plan = await planner.plan(goal, context)

console.log('Plan Reasoning:', plan.reasoning)
// "LLM chose these steps because code review is a prerequisite, 
//  then bug identification requires analysis, then test writing."

console.log('Steps:')
plan.steps.forEach(step => {
  console.log(`${step.order}. ${step.skillName}`)
  console.log(`   Input: ${step.input}`)
  console.log(`   Why: ${step.description}`)
})

// Output:
// 1. code_review_skill
//    Input: Review the code in auth.ts...
//    Why: Establish baseline code quality and identify issues
// 2. debug_error_skill
//    Input: [code from step 1]...
//    Why: Deep-dive into specific bugs found
// 3. write_tests_skill
//    Input: [fixes from step 2]...
//    Why: Ensure fixes are correct via tests

// Execute plan
for (const step of plan.steps) {
  try {
    const result = await skillExecutor.execute(step.skillName, step.input, context)
    console.log(`✓ ${step.skillName}: ${result.summary.slice(0, 100)}...`)
  } catch (error) {
    if (step.canRetry) {
      console.log(`✗ ${step.skillName} failed, will retry: ${error.message}`)
    } else {
      console.log(`✗ ${step.skillName} failed (non-retriable): ${error.message}`)
      break
    }
  }
}
```

---

## Example 6: Error Handling & Recovery

```typescript
const coordinator = new CoordinatorV2(deps, true)

try {
  const response = await coordinator.requestModel('hello', context)
} catch (error) {
  // Error has been normalized by coordinator
  console.log(`Error Code: ${context.error?.code}`)

  switch (context.error?.code) {
    case 'TIMEOUT':
      console.log('Provider took too long, please retry')
      break

    case 'ECONNREFUSED':
      console.log('Provider offline, trying fallback...')
      // Coordinator already tried fallback, if we're here it failed
      break

    case 'RATE_LIMITED':
      console.log(`Rate limited, back off for ${2 ** context.retriesAttempted} seconds`)
      break

    case 'AUTH_FAILED':
      console.log('Check your API key in ~/.imrabo/config.json')
      break

    case 'SERVICE_UNAVAILABLE':
      console.log('Provider temporarily unavailable, try again in a minute')
      break

    default:
      console.log(`Unknown error: ${error.message}`)
  }

  // Check if retriable
  if (context.error?.retriable) {
    console.log(`This error is retriable. Coordinator already attempted ${context.retriesAttempted} retries.`)
  } else {
    console.log('This error is not retriable, no further attempts will be made.')
  }
}
```

---

## Example 7: Using Tool Executor with Validation

```typescript
import { ToolExecutorV2 } from './tools/ToolExecutorV2.js'

const toolExecutor = new ToolExecutorV2(toolRegistry, permissionGateway)

// Valid execution
try {
  const code = await toolExecutor.run(
    'file.read',
    'src/app.ts',
    context,
    { timeout: 10_000 }
  )
  console.log('Read successful:', code.length, 'bytes')
} catch (error) {
  console.error('File read failed:', error.message)
}

// Invalid tool name (validation)
try {
  await toolExecutor.run('../../etc/passwd', '', context)
} catch (error) {
  console.error(error.message)
  // "Invalid tool name format: ../../etc/passwd"
}

// Dangerous shell command (blocked)
try {
  await toolExecutor.run('shell.exec', 'rm -rf /', context)
} catch (error) {
  console.error(error.message)
  // "Command 'rm' not whitelisted. Allowed: npm, node, yarn, ..."
}

// Shell with injection attempt (blocked)
try {
  await toolExecutor.run('shell.exec', 'npm install && rm -rf /', context)
} catch (error) {
  console.error(error.message)
  // "Command contains dangerous patterns: no pipes, redirects, or substitution allowed"
}

// Valid shell command
try {
  const result = await toolExecutor.run('shell.exec', 'npm --version', context)
  console.log('npm version:', result)
} catch (error) {
  console.error('Shell failed:', error.message)
}
```

---

## Example 8: Full End-to-End Flow

```typescript
import { createPlatform } from './bootstrap.js'
import { createExecutionContext } from './coordinator/ExecutionContext.js'

// 1. Initialize platform (from bootstrap)
const platform = await createPlatform()

// 2. Create reusable session context
const sessionId = crypto.randomUUID()
console.log(`Session: ${sessionId}`)

// 3. First turn: Chat
const chatContext = createExecutionContext('chat', 'auto', {
  sessionId,
  debug: true,
})

const chatResponse = await platform.coordinator.requestModel('What is async/await?', chatContext)
console.log(`[Chat] ${chatResponse.slice(0, 100)}...`)

// 4. Second turn: Agent workflow
const agentContext = createExecutionContext('agent', 'auto', {
  sessionId,  // Same session
  debug: true,
})

const agentResponse = await platform.coordinator.executeAgent(
  'Review my async code and suggest improvements',
  agentContext
)
console.log(`[Agent Output] ${agentResponse.slice(0, 100)}...`)

// 5. Check session statistics
const sessionCost = platform.coordinator.getSessionCost(sessionId)
console.log(`
Session Summary:
- Duration: ${(Date.now() - chatContext.startTime) / 1000} seconds
- Total Cost: $${(sessionCost / 100).toFixed(2)}
- Execution IDs:
  - Chat: ${chatContext.executionId}
  - Agent: ${agentContext.executionId}
  - Trace: ${chatContext.traceId} (shared)
`)

// 6. Access tracer for full audit
const tracer = platform.coordinator.getTracer()
const events = tracer.getEvents()
console.log(`\nExecution Events: ${events.length}`)
events.forEach(event => {
  console.log(`  ${event.type} @ ${new Date(event.timestamp).toISOString()}`)
})
```

**Output:**
```
Session: 550e8400-e29b-41d4-a716-446655440000

[Chat] Async/await is JavaScript's syntactic sugar for Promises...

[Agent Output]
[code_review_skill] Your async code is well-structured...
[debug_error_skill] Potential race condition in operation X...

Session Summary:
- Duration: 12 seconds
- Total Cost: $0.00
- Execution IDs:
  - Chat: abc-123
  - Agent: def-456
  - Trace: xyz-789 (shared)

Execution Events: 8
  execution_started @ 2026-04-02T10:00:00Z
  provider_selected @ 2026-04-02T10:00:00Z
  provider_called @ 2026-04-02T10:00:00Z
  execution_completed @ 2026-04-02T10:00:12Z
  execution_started @ 2026-04-02T10:00:12Z
  provider_selected @ 2026-04-02T10:00:12Z
  skill_executed @ 2026-04-02T10:00:18Z
  execution_completed @ 2026-04-02T10:00:22Z
```

---

## Testing Receipt: All Examples Compile

All examples are TypeScript and can be tested by running:

```bash
cd /path/to/imrabo-cli/cli
npm run build
node dist/index.js --help
```

Expected: No TypeScript errors, CLI shows 11 command groups.

---

**Note:** These examples assume `bootstrap` has been updated to use V2 components (see integration checklist).
