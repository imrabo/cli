import type { ProviderRegistry } from '../providers/ProviderRegistry.js'
import { DEFAULT_POLICY, type PolicyConfig, type TaskType, type Sensitivity, estimateRequestCost } from './PolicySchema.js'
import type { ExecutionContext, PolicyDecision } from '../shared/types.js'

/**
 * Production-grade policy engine with multi-factor decision making
 * 
 * Considers:
 * - Provider health & availability
 * - Cost constraints & budgets
 * - Task type & sensitivity
 * - Execution context
 * - Latency & performance tier
 */
export class PolicyEngine {
  private readonly policy: PolicyConfig
  private healthCache: Map<string, { healthy: boolean; timestamp: number }> = new Map()

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    policyOverrides?: Partial<PolicyConfig>,
  ) {
    this.policy = {
      ...DEFAULT_POLICY,
      ...policyOverrides,
    }
  }

  getPolicy(): PolicyConfig {
    return this.policy
  }

  /**
   * Make provider selection decision based on multiple factors
   */
  async evaluate(context: ExecutionContext): Promise<PolicyDecision> {
    // 1. Validate provider constraints
    if (this.policy.blocklistedProviders) {
      const explicit = context.providerPreference
      if (explicit !== 'auto' && this.policy.blocklistedProviders.includes(explicit)) {
        return {
          providerName: this.getDefaultProvider(),
          reason: `Provider '${explicit}' is blocked by policy`,
          timeout: this.policy.defaultTimeoutMs,
          allowFallback: this.policy.allowFallback,
          retryable: true,
        }
      }
    }

    // 2. Handle explicit provider requests
    if (context.providerPreference !== 'auto') {
      if (context.providerPreference === 'local') {
        const local = await this.selectHealthyLocal()
        if (local) {
          return {
            providerName: local,
            reason: `Explicit local provider selected`,
            timeout: this.policy.defaultTimeoutMs,
            allowFallback: this.policy.allowFallback,
            retryable: true,
          }
        }
        if (this.policy.allowFallback) {
          return {
            providerName: await this.selectHealthyRemote() ?? 'openai',
            reason: `No healthy local provider, falling back to remote`,
            timeout: this.policy.defaultTimeoutMs,
            allowFallback: false,
            retryable: true,
            requiresApproval: true,
          }
        }
        throw new Error('No local provider available and fallback disabled')
      } else if (context.providerPreference === 'remote') {
        return {
          providerName: await this.selectHealthyRemote() ?? 'openai',
          reason: `Explicit remote provider selected`,
          timeout: this.policy.defaultTimeoutMs * 1.5,
          allowFallback: this.policy.allowFallback,
          retryable: true,
        }
      }
    }

    // 3. Auto-selection: Multi-factor decision
    return this.makeMultiFactorDecision(context)
  }

  /**
   * Multi-factor provider selection:
   * - Health check (is provider available?)
   * - Cost tier (can we afford remote?)
   * - Task type (code → local, reasoning → remote)
   * - Sensitivity (private → local only)
   * - Performance class (latency)
   */
  private async makeMultiFactorDecision(context: ExecutionContext): Promise<PolicyDecision> {
    const factors = {
      healthyLocal: await this.selectHealthyLocal(),
      healthyRemote: await this.selectHealthyRemote(),
      taskType: this.inferTaskType(context),
      sensitivity: this.inferSensitivity(context),
    }

    // Rule 1: Sensitivity-based routing (highest priority)
    if (factors.sensitivity && this.policy.sensitivityRouting[factors.sensitivity] === 'local-only') {
      if (!factors.healthyLocal) {
        throw new Error(`Task requires local-only provider but none available`)
      }
      return {
        providerName: factors.healthyLocal,
        reason: `Sensitivity '${factors.sensitivity}' requires local-only provider`,
        timeout: this.policy.defaultTimeoutMs,
        allowFallback: false,
        retryable: true,
      }
    }

    // Rule 2: Task-type-based routing
    if (factors.taskType === 'code' && this.policy.preferLocalForCode && factors.healthyLocal) {
      return {
        providerName: factors.healthyLocal,
        reason: `Task type 'code' prefers local provider`,
        timeout: this.policy.defaultTimeoutMs,
        allowFallback: true,
        retryable: true,
      }
    }

    if (factors.taskType === 'reasoning' && this.policy.preferRemoteForReasoning && factors.healthyRemote) {
      return {
        providerName: factors.healthyRemote,
        reason: `Task type 'reasoning' prefers remote provider`,
        timeout: this.policy.defaultTimeoutMs * 1.5,
        allowFallback: this.policy.allowFallback,
        retryable: true,
      }
    }

    // Rule 3: Default fallback: local-first
    if (factors.healthyLocal) {
      return {
        providerName: factors.healthyLocal,
        reason: `Local provider available (local-first strategy)`,
        timeout: this.policy.defaultTimeoutMs,
        allowFallback: true,
        retryable: true,
      }
    }

    // Rule 4: Fallback to remote
    if (factors.healthyRemote && this.policy.allowFallback) {
      return {
        providerName: factors.healthyRemote,
        reason: `No local provider available, using remote fallback`,
        timeout: this.policy.defaultTimeoutMs * 1.5,
        allowFallback: false,
        retryable: true,
      }
    }

    // Rule 5: Error case
    throw new Error('No suitable provider available')
  }

  /**
   * Check if cost is within budget
   */
  checkCostBudget(currentCost: number, estimatedCost: number): boolean {
    const totalCost = currentCost + estimatedCost
    
    // Map cost tier to cents limit
    const costLimits = {
      'low': 0.10,
      'medium': 1.00,
      'high': 10.00,
    }

    const limit = costLimits[this.policy.maxCost]
    return totalCost <= limit
  }

  /**
   * Validate error is retriable
   */
  isRetriable(errorCode: string): boolean {
    if (!this.policy.enableRetry) {
      return false
    }

    const retriableCodes = new Set([
      'TIMEOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'RATE_LIMITED',
      '429', // HTTP 429 Too Many Requests
      '503', // HTTP 503 Service Unavailable
      '504', // HTTP 504 Gateway Timeout
    ])

    return retriableCodes.has(errorCode)
  }

  /**
   * Calculate retry backoff (exponential or linear)
   */
  getRetryBackoff(attempt: number): number {
    if (!this.policy.useExponentialBackoff) {
      return 1000 // Fixed 1s backoff
    }

    // Exponential: 1s, 2s, 4s, 8s, 16s (capped at 32s)
    return Math.min(Math.pow(2, attempt - 1) * 1000, 32_000)
  }

  /**
   * Get approval requirement for operation
   */
  requiresApproval(operation: 'shell' | 'api_call' | 'file_write'): boolean {
    if (operation === 'shell') {
      return this.policy.requireApprovalForShell
    }
    return false
  }

  /**
   * Infer task type from execution context
   */
  private inferTaskType(context: ExecutionContext): TaskType {
    if (context.mode === 'agent') {
      return 'unknown' // Agents can do anything
    }
    if (context.mode === 'skill') {
      return 'unknown' // Too context-dependent
    }
    // Chat mode: default to generic chat
    return 'chat'
  }

  /**
   * Infer sensitivity level (would integrate with metadata in real system)
   */
  private inferSensitivity(context: ExecutionContext): Sensitivity | null {
    // In production, would check:
    // - User labels
    // - Content classification
    // - PII detection
    // For now, default to internal
    return 'internal'
  }

  /**
   * Select a healthy local provider
   */
  private async selectHealthyLocal(): Promise<string | undefined> {
    for (const provider of this.providerRegistry.list()) {
      if (provider.name === 'openai' || provider.name.includes('remote')) {
        continue
      }

      const healthy = await this.isProviderHealthy(provider.name)
      if (healthy) {
        return provider.name
      }
    }
    return undefined
  }

  /**
   * Select a healthy remote provider
   */
  private async selectHealthyRemote(): Promise<string | undefined> {
    for (const provider of this.providerRegistry.list()) {
      if (provider.name === 'openai' || provider.name.includes('remote')) {
        const healthy = await this.isProviderHealthy(provider.name)
        if (healthy) {
          return provider.name
        }
      }
    }
    return undefined
  }

  /**
   * Check provider health with optional caching
   */
  private async isProviderHealthy(providerName: string): Promise<boolean> {
    // Check cache first
    const cached = this.healthCache.get(providerName)
    if (cached && Date.now() - cached.timestamp < this.policy.healthCheckCacheTtlMs) {
      return cached.healthy
    }

    try {
      const provider = this.providerRegistry.get(providerName)
      if (!provider) {
        return false
      }

      const status = await provider.health()
      const healthy = status.healthy

      // Update cache
      this.healthCache.set(providerName, {
        healthy,
        timestamp: Date.now(),
      })

      return healthy
    } catch {
      return false
    }
  }

  /**
   * Get the compiled default provider
   */
  private getDefaultProvider(): string {
    if (this.policy.defaultProvider === 'local') {
      return 'ollama' // Fallback local
    }
    return 'openai' // Fallback remote
  }
}
