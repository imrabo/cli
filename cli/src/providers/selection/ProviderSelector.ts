import type { PolicyEngine } from '../../policy/PolicyEngine.js'
import type { ProviderTarget } from '../../shared/types.js'
import type { ProviderRegistry } from '../ProviderRegistry.js'

export class ProviderSelector {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly policy: PolicyEngine,
  ) {}

  async select(target: ProviderTarget): Promise<string> {
    // Use target provider directly (V1 fallback path)
    const resolved = target
    if (resolved === 'local') {
      return this.pickLocalOrFail()
    }
    if (resolved === 'remote') {
      return this.pickRemoteOrFail()
    }

    const local = await this.pickHealthyLocal()
    if (local) {
      return local
    }

    if (this.policy.getPolicy().allowFallback === true) {
      return this.pickRemoteOrFail()
    }

    throw new Error('No healthy provider found for auto mode')
  }

  private async pickHealthyLocal(): Promise<string | undefined> {
    for (const provider of this.registry.list()) {
      if (provider.name === 'openai' || provider.name.includes('remote')) {
        continue
      }
      const status = await provider.health()
      if (status.healthy) {
        return provider.name
      }
    }
    return undefined
  }

  private pickLocalOrFail(): string {
    const local = this.registry
      .list()
      .find(provider => provider.name !== 'openai' && !provider.name.includes('remote'))
    if (!local) {
      throw new Error('No local provider registered')
    }
    return local.name
  }

  private pickRemoteOrFail(): string {
    const remote = this.registry
      .list()
      .find(provider => provider.name === 'openai' || provider.name.includes('remote'))
    if (!remote) {
      throw new Error('No remote provider registered')
    }
    return remote.name
  }
}
