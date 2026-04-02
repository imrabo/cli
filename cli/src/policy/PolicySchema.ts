export type TaskType = 'chat' | 'code' | 'debug' | 'reasoning' | 'creative' | 'unknown'

export type Sensitivity = 'public' | 'internal' | 'sensitive' | 'private'

export type ProviderConstraint = {
  provider: string
  allowed: boolean
  reason?: string
}

export type PolicyConfig = {
  // Provider selection strategy
  defaultProvider: 'local' | 'remote' | 'auto'
  fallbackProvider: 'local' | 'remote'
  allowFallback: boolean
  
  // Cost controls
  maxCost: 'low' | 'medium' | 'high'      // Per-request budget (in cents)
  maxSessionCost?: number                 // Per-session budget (in cents)
  maxDailyCost?: number                   // Per-day budget (in cents)
  
  // Execution constraints
  maxRetries: number
  defaultTimeoutMs: number
  maxTimeoutMs: number
  
  // Execution behavior
  enableFallback: boolean
  enableRetry: boolean
  useExponentialBackoff: boolean
  
  // Security & Access
  allowedProviders?: string[]
  blocklistedProviders?: string[]
  dangerousToolsAllowed: boolean
  requireApprovalForShell: boolean
  
  // Multi-factor decision settings
  preferLocalForCode: boolean
  preferRemoteForReasoning: boolean
  useHealthChecks: boolean
  healthCheckCacheTtlMs: number
  
  // Sensitivity-based routing
  sensitivityRouting: {
    private: 'local-only' | 'approved-remote' | 'auto'
    sensitive: 'local-only' | 'approved-remote' | 'auto'
    internal: 'local-first' | 'auto'
    public: 'auto'
  }
}

export const DEFAULT_POLICY: PolicyConfig = {
  // Provider selection
  defaultProvider: 'auto',          // Auto-select based on quality
  fallbackProvider: 'remote',
  allowFallback: true,

  // Cost controls (defaults are conservative)
  maxCost: 'low',                   // ~$0.10 per request for remote
  maxSessionCost: 10.00,            // ~$10.00 per 1-hour session
  maxDailyCost: 100.00,             // ~$100 per day

  // Execution constraints
  maxRetries: 3,                    // Retry on transient failures
  defaultTimeoutMs: 30_000,         // 30s
  maxTimeoutMs: 120_000,            // 2min absolute max

  // Execution behavior
  enableFallback: true,
  enableRetry: true,
  useExponentialBackoff: true,

  // Security
  allowedProviders: [],              // All by default
  blocklistedProviders: [],
  dangerousToolsAllowed: false,
  requireApprovalForShell: true,

  // Multi-factor
  preferLocalForCode: true,
  preferRemoteForReasoning: false,
  useHealthChecks: true,
  healthCheckCacheTtlMs: 5000,      // Cache health checks for 5s

  // Sensitivity-based routing
  sensitivityRouting: {
    private: 'local-only',
    sensitive: 'approved-remote',
    internal: 'local-first',
    public: 'auto',
  },
}

/**
 * Estimate cost for a generate request in cents
 * Rough model: ~$0.15 per 1M tokens for remote (OpenAI)
 */
export function estimateRequestCost(
  provider: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (provider === 'ollama' || provider === 'lmstudio') {
    return 0 // Local providers are free
  }

  // Remote HTTP providers (OpenAI, etc.)
  const pricePerMilTokens = {
    'openai': 0.15,                 // ~$0.15 per 1M tokens
    'default': 0.10,                // Conservative estimate
  }

  const rate = pricePerMilTokens[provider as keyof typeof pricePerMilTokens] ?? 
               pricePerMilTokens['default']

  const totalTokens = inputTokens + outputTokens
  return (totalTokens / 1_000_000) * rate
}
