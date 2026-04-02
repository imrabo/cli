import type { GenerateChunk, GenerateRequest } from '../shared/types.js'
import { ProviderSelector } from './selection/ProviderSelector.js'
import type { ProviderRegistry } from './ProviderRegistry.js'

export class ProviderGateway {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly selector: ProviderSelector,
  ) {}

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
}
