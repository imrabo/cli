import type { ModelProvider } from '../ModelProvider.js'
import type {
  GenerateChunk,
  GenerateRequest,
  ModelDescriptor,
  ProviderStatus,
} from '../../shared/types.js'

type LocalHttpProviderOptions = {
  name: string
  baseUrl: string
  generatePath: string
  modelsPath: string
  healthPath: string
}

async function* streamText(response: Response): AsyncIterable<GenerateChunk> {
  const body = response.body
  if (!body) {
    const fallback = await response.text()
    yield { text: fallback, done: true }
    return
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let done = false
  while (!done) {
    const chunk = await reader.read()
    done = chunk.done
    if (chunk.value) {
      yield { text: decoder.decode(chunk.value, { stream: true }) }
    }
  }
  yield { text: '', done: true }
}

export class GenericLocalHttpProvider implements ModelProvider {
  readonly name: string
  private readonly baseUrl: string
  private readonly generatePath: string
  private readonly modelsPath: string
  private readonly healthPath: string

  constructor(options: LocalHttpProviderOptions) {
    this.name = options.name
    this.baseUrl = options.baseUrl
    this.generatePath = options.generatePath
    this.modelsPath = options.modelsPath
    this.healthPath = options.healthPath
  }

  async *generate(input: GenerateRequest): AsyncIterable<GenerateChunk> {
    const response = await fetch(new URL(this.generatePath, this.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(`${this.name} generate failed: ${response.status}`)
    }

    yield* streamText(response)
  }

  async models(): Promise<ModelDescriptor[]> {
    const response = await fetch(new URL(this.modelsPath, this.baseUrl))
    if (!response.ok) {
      return []
    }
    const payload = (await response.json()) as { models?: Array<{ id?: string; name?: string }> }
    return (payload.models ?? []).map(item => ({
      id: item.id ?? item.name ?? 'unknown',
      provider: this.name,
    }))
  }

  async health(): Promise<ProviderStatus> {
    try {
      const response = await fetch(new URL(this.healthPath, this.baseUrl))
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
