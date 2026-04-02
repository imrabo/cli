import type { ModelProvider } from '../ModelProvider.js'
import type {
  GenerateChunk,
  GenerateRequest,
  ModelDescriptor,
  ProviderStatus,
} from '../../shared/types.js'

type GenericHttpProviderOptions = {
  name: string
  baseUrl: string
  apiKey?: string
  generatePath: string
  modelsPath: string
  healthPath?: string
}

type ModelsPayload = {
  data?: Array<{ id?: string; name?: string }>
  models?: Array<{ id?: string; name?: string }>
}

export class GenericHttpProvider implements ModelProvider {
  readonly name: string
  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly generatePath: string
  private readonly modelsPath: string
  private readonly healthPath: string

  constructor(options: GenericHttpProviderOptions) {
    this.name = options.name
    this.baseUrl = options.baseUrl
    this.apiKey = options.apiKey
    this.generatePath = options.generatePath
    this.modelsPath = options.modelsPath
    this.healthPath = options.healthPath ?? options.modelsPath
  }

  async *generate(input: GenerateRequest): AsyncIterable<GenerateChunk> {
    const response = await fetch(new URL(this.generatePath, this.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(`${this.name} generate failed: ${response.status}`)
    }

    const text = await response.text()
    yield { text, done: true }
  }

  async models(): Promise<ModelDescriptor[]> {
    const response = await fetch(new URL(this.modelsPath, this.baseUrl), {
      headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
    })
    if (!response.ok) {
      return []
    }
    const payload = (await response.json()) as ModelsPayload
    const list = payload.data ?? payload.models ?? []
    return list.map(item => ({
      id: item.id ?? item.name ?? 'unknown',
      provider: this.name,
    }))
  }

  async health(): Promise<ProviderStatus> {
    try {
      const response = await fetch(new URL(this.healthPath, this.baseUrl), {
        headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
      })
      return {
        healthy: response.ok,
        details: response.ok ? 'ok' : `status:${response.status}`,
      }
    } catch (error) {
      return {
        healthy: false,
        details: error instanceof Error ? error.message : 'unknown_error',
      }
    }
  }
}
