import type { GenerateChunk, GenerateRequest, ProviderResponse } from '../shared/types.js'
import { ProviderSelector } from './selection/ProviderSelector.js'
import type { ProviderRegistry } from './ProviderRegistry.js'

/**
 * Production-grade ProviderGateway with:
 * - Timeout enforcement
 * - Error normalization
 * - Streaming standardization
 * - Response validation
 */
export class ProviderGatewayV2 {
  private static readonly DEFAULT_TIMEOUT_MS = 30_000

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly selector: ProviderSelector,
  ) {}

  /**
   * Generate with provider selection and normalization
   * 
   * Returns normalized ProviderResponse with:
   * - content: full response text
   * - tokensUsed: { input, output }
   * - latencyMs: actual latency
   * - provider: which provider was used
   */
  async generateWithNormalization(
    request: GenerateRequest,
    target: 'local' | 'remote' | 'auto',
    timeoutMs: number = ProviderGatewayV2.DEFAULT_TIMEOUT_MS,
  ): Promise<ProviderResponse> {
    const providerName = await this.selector.select(target)
    const provider = this.registry.get(providerName)

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`)
    }

    const startTime = Date.now()
    const controller = new AbortController()
    const timerId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const chunks: string[] = []

      // Collect all chunks with timeout enforcement
      for await (const chunk of provider.generate(request)) {
        if (controller.signal.aborted) {
          throw new Error(`Provider timeout after ${timeoutMs}ms`)
        }

        if (chunk.text) {
          chunks.push(chunk.text)
        }
      }

      const latencyMs = Date.now() - startTime
      const content = chunks.join('')
      const inputTokens = this.estimateTokens(JSON.stringify(request.messages))
      const outputTokens = this.estimateTokens(content)

      const response: ProviderResponse = {
        content,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        latencyMs,
        provider: providerName,
      }

      // Only set model if provided
      if (request.model) {
        response.model = request.model
      }

      return response
    } catch (error) {
      const latencyMs = Date.now() - startTime
      const errMsg = error instanceof Error ? error.message : String(error)
      const normalized = this.normalizeError(errMsg)

      return {
        content: '',
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs,
        provider: providerName,
        error: normalized,
      }
    } finally {
      clearTimeout(timerId)
    }
  }

  /**
   * Stream-safe generator (legacy, for backward compat)
   */
  async *generate(
    request: GenerateRequest,
    target: 'local' | 'remote' | 'auto',
  ): AsyncIterable<GenerateChunk> {
    const providerName = await this.selector.select(target)
    const provider = this.registry.get(providerName)

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`)
    }

    yield* provider.generate(request)
  }

  /**
   * Normalize errors to standard schema
   */
  private normalizeError(errorMsg: string): {
    code: string
    message: string
    retriable: boolean
  } {
    const msg = errorMsg.toLowerCase()

    // Network errors
    if (msg.includes('econnrefused')) {
      return {
        code: 'ECONNREFUSED',
        message: 'Provider unavailable (connection refused)',
        retriable: true,
      }
    }
    if (msg.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Provider request timeout',
        retriable: true,
      }
    }

    // HTTP status errors
    if (msg.includes('401')) {
      return {
        code: 'UNAUTHORIZED',
        message: 'Provider authentication failed',
        retriable: false,
      }
    }
    if (msg.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Provider rate limit exceeded',
        retriable: true,
      }
    }
    if (msg.includes('503')) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Provider temporarily unavailable',
        retriable: true,
      }
    }

    // Default
    return {
      code: 'PROVIDER_ERROR',
      message: errorMsg,
      retriable: false,
    }
  }

  /**
   * Simple token estimation (1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
