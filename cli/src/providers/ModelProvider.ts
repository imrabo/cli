import type {
  GenerateChunk,
  GenerateRequest,
  ModelDescriptor,
  ProviderStatus,
} from '../shared/types.js'

export interface ModelProvider {
  name: string
  generate(input: GenerateRequest): AsyncIterable<GenerateChunk>
  models(): Promise<ModelDescriptor[]>
  health(): Promise<ProviderStatus>
}
