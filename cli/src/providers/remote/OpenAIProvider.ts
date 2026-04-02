import { GenericHttpProvider } from './GenericHttpProvider.js'

export class OpenAIProvider extends GenericHttpProvider {
  constructor(apiKey?: string, baseUrl = 'https://api.openai.com') {
    super({
      name: 'openai',
      baseUrl,
      ...(apiKey ? { apiKey } : {}),
      generatePath: '/v1/chat/completions',
      modelsPath: '/v1/models',
    })
  }
}
