import { GenericLocalHttpProvider } from './GenericLocalHttpProvider.js'

export class OllamaProvider extends GenericLocalHttpProvider {
  constructor(baseUrl = 'http://127.0.0.1:11434') {
    super({
      name: 'ollama',
      baseUrl,
      generatePath: '/api/chat',
      modelsPath: '/api/tags',
      healthPath: '/api/tags',
    })
  }
}
