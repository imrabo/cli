import type { ExecutionContext as ExecutionContextType, ProviderTarget } from '../shared/types.js'
import { createChildExecutionContext } from './ExecutionContext.js'
import { ExecutionTracer } from './ExecutionTracer.js'
import type { PolicyEngine } from '../policy/PolicyEngine.js'
import type { ProviderGateway } from '../providers/ProviderGateway.js'
import type { AgentEngine } from '../agents/AgentEngine.js'

/**
 * Production-grade Coordinator Layer
 * 
 * Responsibilities:
 * - Single execution entry point (no bypasses)
 * - Provider selection via policy engine
 * - Timeout enforcement
 * - Automatic retry with exponential backoff
 * - Cost tracking & budgeting
 * - Structured execution tracing
 * - Error normalization
 * - Complete execution lifecycle management
 */
export class CoordinatorV2 {
  private readonly tracer: ExecutionTracer
  private sessionCosts: Map<string, number> = new Map()

  constructor(
    private readonly deps: {
      providerGateway: ProviderGateway
      policy: PolicyEngine
      runAgent: (goal: string, context: ExecutionContextType) => Promise<string>
    },
    debugMode: boolean = false,
  ) {
    this.tracer = new ExecutionTracer(debugMode)
  }

  /**
   * Request model execution (core gate)
   * 
   * This is the ONLY place where provider calls are made.
   * All execution must go through this method.
   */
  async requestModel(
    prompt: string,
    context: ExecutionContextType,
  ): Promise<string> {
    // Update context state
    context.status = 'running'
    context.startTime = Date.now()

    this.tracer.logExecutionStart(context, {
      prompt: prompt.slice(0, 100),
    })

    try {
      // 1. Policy evaluation
      const decision = await this.deps.policy.evaluate(context)
      context.providerUsed = decision.providerName

      this.tracer.logProviderSelected(context, decision.providerName, decision.reason)

      // 2. Cost estimation
      const estimatedCost = this.estimateCost(decision.providerName, prompt)
      const sessionCost = this.sessionCosts.get(context.sessionId) ?? 0

      if (!this.deps.policy.checkCostBudget(sessionCost, estimatedCost)) {
        this.tracer.logCostExceeded(context, sessionCost, 0.10)
        throw new Error('Cost budget exceeded')
      }

      // 3. Retry logic with exponential backoff
      const maxRetries = this.deps.policy.getPolicy().maxRetries
      let lastError: Error | undefined

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            const waitMs = this.deps.policy.getPolicy().useExponentialBackoff
              ? Math.pow(2, attempt - 2) * 1000
              : 1000

            this.tracer.logRetryAttempt(
              context,
              attempt,
              waitMs,
              lastError?.message ?? 'Unknown error',
            )

            await new Promise(r => setTimeout(r, waitMs))
          }

          context.retriesAttempted = attempt - 1

          // 4. Execute with timeout
          const response = await this.executeWithTimeout(
            () =>
              this.deps.providerGateway.generate(
                { messages: [{ role: 'user', content: prompt }] },
                (decision.providerName as ProviderTarget),
              ),
            decision.timeout,
            context,
          )

          // 5. Track cost
          const model = response.model ?? decision.providerName
          const actualCost = this.estimateCostFromResponse(model, response.tokensUsed)
          this.sessionCosts.set(
            context.sessionId,
            sessionCost + actualCost,
          )

          context.costEstimate = sessionCost + actualCost
          context.tokensUsed = {
            ...response.tokensUsed,
            total: response.tokensUsed.input + response.tokensUsed.output,
          }
          context.status = 'success'

          const endTime = Date.now()
          context.endTime = endTime
          context.durationMs = endTime - context.startTime

          this.tracer.logExecutionComplete(
            context,
            context.durationMs,
            {
              provider: response.provider,
              tokens: response.tokensUsed,
              cost: actualCost,
            },
          )

          this.tracer.attachToContext(context)
          return response.content
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          // Normalize error
          const normalized = this.normalizeError(lastError)
          this.tracer.logErrorNormalized(context, lastError.message, normalized)

          if (!normalized.retriable) {
            throw lastError
          }

          if (attempt === maxRetries) {
            throw lastError
          }
        }
      }

      throw lastError ?? new Error('Failed after max retries')
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      context.status = 'failure'
      context.endTime = Date.now()
      context.durationMs = context.endTime - context.startTime
      context.error = {
        code: err.name,
        message: err.message,
        retriable: this.isRetriable(err),
        lastAttemptTime: context.endTime,
      }

      this.tracer.logExecutionFailed(
        context,
        context.durationMs,
        { code: err.name, message: err.message },
      )

      this.tracer.attachToContext(context)
      throw err
    }
  }

  /**
   * Chat mode (direct model call)
   */
  async chat(prompt: string, context: ExecutionContextType): Promise<string> {
    return this.requestModel(prompt, context)
  }

  /**
   * Agent mode (multi-step reasoning)
   */
  async executeAgent(goal: string, context: ExecutionContextType): Promise<string> {
    context.status = 'running'
    context.startTime = Date.now()

    this.tracer.logExecutionStart(context, { goal })

    try {
      const result = await this.deps.runAgent(goal, context)
      context.status = 'success'
      context.endTime = Date.now()
      context.durationMs = context.endTime - context.startTime

      this.tracer.logExecutionComplete(context, context.durationMs)
      this.tracer.attachToContext(context)

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      context.status = 'failure'
      context.endTime = Date.now()
      context.durationMs = context.endTime - context.startTime
      context.error = {
        code: err.name,
        message: err.message,
        retriable: false,
        lastAttemptTime: context.endTime,
      }

      this.tracer.logExecutionFailed(
        context,
        context.durationMs,
        { code: err.name, message: err.message },
      )

      this.tracer.attachToContext(context)
      throw err
    }
  }

  /**
   * Route chat or agent mode
   */
  async routeChat(
    prompt: string,
    context: ExecutionContextType,
    mode: 'direct' | 'agent' = 'direct',
  ): Promise<string> {
    if (mode === 'agent') {
      return this.executeAgent(prompt, context)
    }
    return this.chat(prompt, context)
  }

  /**
   * Execute async function with timeout and AbortController
   */
  private async executeWithTimeout<T>(
    fn: () => AsyncIterable<T>,
    timeoutMs: number,
    context: ExecutionContextType,
  ): Promise<T & { content: string; tokensUsed: { input: number; output: number }; model: string; provider: string; latencyMs: number }> {
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const chunks: string[] = []
      const startTime = Date.now()

      for await (const chunk of fn()) {
        if (controller.signal.aborted) {
          this.tracer.logTimeoutTriggered(context, timeoutMs, 'provider.generate')
          throw new Error(`Request timeout after ${timeoutMs}ms`)
        }

        // Assume chunk has a 'text' property (from provider stream)
        const text = (chunk as any).text ?? ''
        chunks.push(text)
      }

      const latencyMs = Date.now() - startTime

      // Return normalized response
      return {
        content: chunks.join(''),
        tokensUsed: { input: 0, output: chunks.join('').split(/\s+/).length },
        model: '',
        provider: context.providerUsed ?? '',
        latencyMs,
      } as any
    } finally {
      clearTimeout(timerId)
    }
  }

  /**
   * Normalize errors to standard error codes
   */
  private normalizeError(error: Error): {
    code: string
    message: string
    retriable: boolean
  } {
    const msg = error.message.toLowerCase()

    // Network errors (retriable)
    if (msg.includes('econnrefused') || msg.includes('refused')) {
      return {
        code: 'ECONNREFUSED',
        message: 'Provider connection refused (offline?)',
        retriable: true,
      }
    }
    if (msg.includes('econnreset')) {
      return {
        code: 'ECONNRESET',
        message: 'Provider connection reset by peer',
        retriable: true,
      }
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        code: 'TIMEOUT',
        message: 'Provider request timed out',
        retriable: true,
      }
    }

    // HTTP errors
    if (msg.includes('429') || msg.includes('rate limit')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Provider rate limited, please retry',
        retriable: true,
      }
    }
    if (msg.includes('503') || msg.includes('unavailable')) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Provider service temporarily unavailable',
        retriable: true,
      }
    }
    if (msg.includes('401') || msg.includes('unauthorized')) {
      return {
        code: 'AUTH_FAILED',
        message: 'Authentication failed (bad token?)',
        retriable: false,
      }
    }
    if (msg.includes('403')) {
      return {
        code: 'FORBIDDEN',
        message: 'Access forbidden by provider',
        retriable: false,
      }
    }

    // Default
    return {
      code: error.name || 'ERROR',
      message: error.message,
      retriable: false,
    }
  }

  /**
   * Check if error is retriable
   */
  private isRetriable(error: Error): boolean {
    const normalized = this.normalizeError(error)
    return normalized.retriable
  }

  /**
   * Estimate cost for prompt (rough heuristic)
   */
  private estimateCost(provider: string, prompt: string): number {
    if (provider === 'ollama' || provider === 'lmstudio') {
      return 0 // Local providers free
    }

    // Estimate 1 token per 4 characters for input, 500 output tokens average
    const inputTokens = Math.ceil(prompt.length / 4)
    const outputTokens = 500

    // ~$0.15 per 1M tokens for OpenAI
    const totalTokens = inputTokens + outputTokens
    return (totalTokens / 1_000_000) * 0.15
  }

  /**
   * Estimate cost from actual response
   */
  private estimateCostFromResponse(
    provider: string,
    tokens: { input: number; output: number },
  ): number {
    if (provider === 'ollama' || provider === 'lmstudio') {
      return 0
    }

    const totalTokens = tokens.input + tokens.output
    return (totalTokens / 1_000_000) * 0.15
  }

  /**
   * Get session cost tracking
   */
  getSessionCost(sessionId: string): number {
    return this.sessionCosts.get(sessionId) ?? 0
  }

  /**
   * Reset session cost
   */
  resetSessionCost(sessionId: string): void {
    this.sessionCosts.delete(sessionId)
  }

  /**
   * Get execution tracer (for debug access)
   */
  getTracer(): ExecutionTracer {
    return this.tracer
  }
}
