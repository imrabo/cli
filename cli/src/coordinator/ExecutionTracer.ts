import type { ExecutionEvent, ExecutionContext } from '../shared/types.js'

/**
 * Centralized execution tracing system.
 * Emits structured events for all execution phases.
 * Supports debug mode with full event collection.
 */
export class ExecutionTracer {
  private events: ExecutionEvent[] = []
  private isDebugMode: boolean

  constructor(debugMode: boolean = false) {
    this.isDebugMode = debugMode
  }

  /**
   * Emit a structured execution event
   */
  emit(event: Omit<ExecutionEvent, 'timestamp'>): void {
    const fullEvent: ExecutionEvent = {
      ...event,
      timestamp: Date.now(),
    }

    this.events.push(fullEvent)

    // Always log errors and important events to stderr
    if (this.isDebugMode || event.type.includes('failed') || event.type.includes('error')) {
      process.stderr.write(JSON.stringify(fullEvent) + '\n')
    }
  }

  /**
   * Get all collected events
   */
  getEvents(): ExecutionEvent[] {
    return [...this.events]
  }

  /**
   * Clear events (for new execution)
   */
  clear(): void {
    this.events = []
  }

  /**
   * Attach events to context for debug mode
   */
  attachToContext(context: ExecutionContext): void {
    if (this.isDebugMode) {
      context.debugEvents = this.getEvents()
    }
  }

  /**
   * Log execution started
   */
  logExecutionStart(context: ExecutionContext, details?: Record<string, unknown>): void {
    this.emit({
      type: 'execution_started',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        mode: context.mode,
        providerPreference: context.providerPreference,
        ...details,
      },
    })
  }

  /**
   * Log execution completed
   */
  logExecutionComplete(
    context: ExecutionContext,
    durationMs: number,
    details?: Record<string, unknown>,
  ): void {
    this.emit({
      type: 'execution_completed',
      executionId: context.executionId,
      traceId: context.traceId,
      duration: durationMs,
      details: {
        status: 'success',
        provider: context.providerUsed,
        retries: context.retriesAttempted,
        ...details,
      },
    })
  }

  /**
   * Log execution failure
   */
  logExecutionFailed(
    context: ExecutionContext,
    durationMs: number,
    error: { code: string; message: string },
  ): void {
    this.emit({
      type: 'execution_failed',
      executionId: context.executionId,
      traceId: context.traceId,
      duration: durationMs,
      error,
      details: {
        retries: context.retriesAttempted,
        provider: context.providerUsed,
      },
    })
  }

  /**
   * Log provider selection decision
   */
  logProviderSelected(
    context: ExecutionContext,
    providerName: string,
    reason: string,
  ): void {
    this.emit({
      type: 'provider_selected',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        provider: providerName,
        reason,
        fallback: context.fallbackUsed,
      },
    })
  }

  /**
   * Log provider call
   */
  logProviderCalled(
    context: ExecutionContext,
    providerName: string,
    inputTokens: number,
  ): void {
    this.emit({
      type: 'provider_called',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        provider: providerName,
        inputTokens,
      },
    })
  }

  /**
   * Log provider failure with error normalization
   */
  logProviderFailed(
    context: ExecutionContext,
    providerName: string,
    error: { code: string; message: string; retriable: boolean },
    durationMs: number,
  ): void {
    this.emit({
      type: 'provider_failed',
      executionId: context.executionId,
      traceId: context.traceId,
      duration: durationMs,
      error: { code: error.code, message: error.message },
      details: {
        provider: providerName,
        retriable: error.retriable,
      },
    })
  }

  /**
   * Log fallback to another provider
   */
  logProviderFallback(
    context: ExecutionContext,
    fromProvider: string,
    toProvider: string,
    reason: string,
  ): void {
    this.emit({
      type: 'provider_fallback',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        from: fromProvider,
        to: toProvider,
        reason,
      },
    })
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    context: ExecutionContext,
    attempt: number,
    waitMs: number,
    reason: string,
  ): void {
    this.emit({
      type: 'retry_attempt',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        attempt,
        waitMs,
        reason,
      },
    })
  }

  /**
   * Log timeout triggered
   */
  logTimeoutTriggered(
    context: ExecutionContext,
    timeoutMs: number,
    stage: string,
  ): void {
    this.emit({
      type: 'timeout_triggered',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        timeoutMs,
        stage,
      },
    })
  }

  /**
   * Log cost exceeded
   */
  logCostExceeded(
    context: ExecutionContext,
    currentCost: number,
    limit: number,
  ): void {
    this.emit({
      type: 'cost_exceeded',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        currentCost,
        limit,
      },
    })
  }

  /**
   * Log tool execution
   */
  logToolExecuted(
    context: ExecutionContext,
    toolName: string,
    durationMs: number,
    success: boolean,
  ): void {
    this.emit({
      type: 'tool_executed',
      executionId: context.executionId,
      traceId: context.traceId,
      duration: durationMs,
      details: {
        tool: toolName,
        success,
      },
    })
  }

  /**
   * Log skill execution
   */
  logSkillExecuted(
    context: ExecutionContext,
    skillName: string,
    durationMs: number,
    success: boolean,
  ): void {
    this.emit({
      type: 'skill_executed',
      executionId: context.executionId,
      traceId: context.traceId,
      duration: durationMs,
      details: {
        skill: skillName,
        success,
      },
    })
  }

  /**
   * Log policy violation
   */
  logPolicyViolation(
    context: ExecutionContext,
    stage: string,
    reason: string,
  ): void {
    this.emit({
      type: 'policy_violation',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        stage,
        reason,
      },
    })
  }

  /**
   * Log error normalization
   */
  logErrorNormalized(
    context: ExecutionContext,
    rawError: string,
    normalized: { code: string; message: string; retriable: boolean },
  ): void {
    this.emit({
      type: 'error_normalized',
      executionId: context.executionId,
      traceId: context.traceId,
      details: {
        raw: rawError.slice(0, 100), // Truncate for logging
        normalized,
      },
    })
  }
}
