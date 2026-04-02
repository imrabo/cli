import { PolicyEngine } from '../policy/PolicyEngine.js'
import { ProviderGateway } from '../providers/ProviderGateway.js'
import type { ProviderTarget, ExecutionContext as ExecutionContextType } from '../shared/types.js'
import type { AgentEngine } from '../agents/AgentEngine.js'

type CoordinatorDeps = {
  providerGateway: ProviderGateway
  policy: PolicyEngine
  runAgent: (goal: string, context: ExecutionContextType) => Promise<string>
}

export class Coordinator {
  constructor(private readonly deps: CoordinatorDeps) {}

  async requestModel(prompt: string, context: ExecutionContextType): Promise<string> {
    // Policy now uses evaluate() to handle complex routing - use default local provider for V1
    const target = context.providerPreference === 'auto' ? 'local' : context.providerPreference
    const chunks: string[] = []

    for await (const chunk of this.deps.providerGateway.generate(
      {
        messages: [{ role: 'user', content: prompt }],
      },
      target,
    )) {
      chunks.push(chunk.text)
    }

    return chunks.join('')
  }

  async chat(prompt: string, context: ExecutionContextType): Promise<string> {
    return this.requestModel(prompt, context)
  }

  async executeAgent(goal: string, context: ExecutionContextType): Promise<string> {
    return this.deps.runAgent(goal, context)
  }

  async routeChat(
    prompt: string,
    context: ExecutionContextType,
    mode: 'direct' | 'agent' = 'direct',
  ): Promise<string> {
    if (mode === 'agent') {
      return this.executeAgent(prompt, context)
    }
    return this.chat(prompt, context)
  }
}
