import type { ModelProvider } from './ModelProvider.js'

export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>()

  register(provider: ModelProvider): void {
    this.providers.set(provider.name, provider)
  }

  get(name: string): ModelProvider | undefined {
    return this.providers.get(name)
  }

  list(): ModelProvider[] {
    return Array.from(this.providers.values())
  }
}
