import crypto from 'node:crypto'
import type { ExecutionContext } from '../shared/types.js'

export function createExecutionContext(
  mode: ExecutionContext['mode'],
  providerPreference: ExecutionContext['providerPreference'] = 'auto',
  opts?: {
    sessionId?: string                    // Reuse session for multi-turn conversations
    traceId?: string                      // Reuse trace for related operations
    parentExecutionId?: string            // Link to parent span (for nested executions)
    debug?: boolean
  },
): ExecutionContext {
  const context: ExecutionContext = {
    // Identity & Tracing
    executionId: crypto.randomUUID(),     // New ID for this specific execution
    sessionId: opts?.sessionId ?? crypto.randomUUID(),  // Reuse or create new
    traceId: opts?.traceId ?? crypto.randomUUID(),      // Reuse or create new

    // Request metadata
    mode,
    cwd: process.cwd(),
    providerPreference,

    // Execution lifecycle
    status: 'pending',
    startTime: Date.now(),
    retriesAttempted: 0,

    // Debug context
    debug: opts?.debug ?? false,
  }

  // Only set optional properties if provided
  if (opts?.parentExecutionId) {
    context.parentExecutionId = opts.parentExecutionId
  }

  return context
}

/**
 * Create a child execution context linked to parent
 */
export function createChildExecutionContext(
  parent: ExecutionContext,
  mode: ExecutionContext['mode'],
): ExecutionContext {
  // Build options without undefined values (for exactOptionalPropertyTypes)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    sessionId: parent.sessionId,      // Same session
    traceId: parent.traceId,          // Same trace
    parentExecutionId: parent.executionId,  // Link to parent
  }

  // Only add debug if it's defined
  if (parent.debug !== undefined) {
    opts.debug = parent.debug
  }

  return createExecutionContext(mode, parent.providerPreference, opts)
}
