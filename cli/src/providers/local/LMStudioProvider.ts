import { GenericLocalHttpProvider } from './GenericLocalHttpProvider.js'

export class LMStudioProvider extends GenericLocalHttpProvider {
  constructor(baseUrl = 'http://127.0.0.1:1234') {
    super({
      name: 'lmstudio',
      baseUrl,
      generatePath: '/v1/chat/completions',
      modelsPath: '/v1/models',
      healthPath: '/v1/models',
    })
  }
}
