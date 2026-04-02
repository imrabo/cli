import type { Coordinator } from '../coordinator/Coordinator.js'
import { createExecutionContext } from '../coordinator/ExecutionContext.js'

export async function runNonInteractiveChat(
  coordinator: Coordinator,
  prompt: string,
  provider: 'local' | 'remote' | 'auto',
): Promise<string> {
  const context = createExecutionContext('chat', provider)
  return coordinator.routeChat(prompt, context, 'direct')
}
