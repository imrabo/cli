export type ProviderTarget = 'local' | 'remote' | 'auto'

export type Role = 'user' | 'assistant' | 'system' | 'tool'

export type ChatMessage = {
  role: Role
  content: string
}

export type GenerateRequest = {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  metadata?: Record<string, string>
}

export type GenerateChunk = {
  text: string
  done?: boolean
}

export type ProviderStatus = {
  healthy: boolean
  details?: string
  latencyMs?: number
  lastChecked?: number
}

export type ModelDescriptor = {
  id: string
  provider: string
  contextWindow?: number
}

export type ExecutionMode = 'chat' | 'agent' | 'skill'

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failure' | 'timeout'

// ===== ENHANCED ExecutionContext with full lifecycle support =====

export type ExecutionContext = {
  // Identity & Tracing
  executionId: string              // Unique ID for this execution (span)
  sessionId: string                // Conversation session ID (reused across turns)
  traceId: string                  // Correlation ID (reused across sub-executions)
  parentExecutionId?: string       // Parent span ID (for nested executions)

  // Request metadata
  mode: ExecutionMode
  cwd: string
  providerPreference: ProviderTarget

  // Execution lifecycle
  status: ExecutionStatus
  startTime: number                // Unix timestamp in ms
  endTime?: number                 // Unix timestamp in ms
  durationMs?: number              // Calculated: endTime - startTime

  // Provider tracking
  providerUsed?: string            // Which provider was selected
  retriesAttempted: number         // How many retries so far
  fallbackUsed?: boolean           // Did we fallback from preferred provider

  // Resource tracking
  costEstimate?: number            // In cents (0.01 USD = 1 "cost unit")
  tokensUsed?: {
    input: number
    output: number
    total: number
  }

  // Error context
  error?: {
    code: string                   // e.g., 'TIMEOUT', 'AUTH_FAILED', 'RATE_LIMITED'
    message: string
    retriable: boolean
    lastAttemptTime?: number
  }

  // Debug context
  debug?: boolean
  debugEvents?: ExecutionEvent[]
}

// ===== Structured event for tracing =====

export type ExecutionEvent = {
  type: 'execution_started' | 'execution_completed' | 'execution_failed' |
        'provider_selected' | 'provider_called' | 'provider_failed' | 'provider_fallback' |
        'tool_executed' | 'skill_executed' | 'skill_called' |
        'retry_attempt' | 'timeout_triggered' | 'cost_exceeded' |
        'policy_violation' | 'error_normalized'
  timestamp: number
  executionId: string
  traceId: string
  details?: Record<string, unknown>
  duration?: number
  error?: {
    code: string
    message: string
  }
}

// ===== Normalized provider response =====

export type ProviderResponse = {
  content: string
  tokensUsed: {
    input: number
    output: number
    total: number
  }
  latencyMs: number
  provider: string
  model?: string
  error?: {
    code: string
    message: string
    retriable: boolean
  }
}

// ===== Tool execution result =====

export type ToolExecutionResult = {
  output: string
  error?: string
  metadata?: {
    size: number
    duration: number
  }
}

// ===== Skill execution result =====

export type SkillExecutionResult = {
  summary: string
  data?: Record<string, unknown>
  nextStep?: string
  error?: string
}

// ===== Policy decision =====

export type PolicyDecision = {
  providerName: string            // Which provider to use
  reason: string                  // Why this decision
  timeout: number                 // In ms
  allowFallback: boolean
  costLimit?: number              // In cents
  retryable: boolean
  requiresApproval?: boolean      // For dangerous operations
}
