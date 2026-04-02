import React from 'react'
import { render } from 'ink'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import type { Coordinator } from '../coordinator/Coordinator.js'
import { createExecutionContext } from '../coordinator/ExecutionContext.js'
import { App } from '../ui/App.js'

export async function startInteractiveChat(
  coordinator: Coordinator,
  provider: 'local' | 'remote' | 'auto',
): Promise<void> {
  const rl = readline.createInterface({ input, output })
  const lines: string[] = ['Interactive mode ready. Type "exit" to quit.']
  let done = false

  while (!done) {
    render(<App title='imrabo chat' lines={lines} />)
    const userInput = await rl.question('> ')
    if (userInput.trim().toLowerCase() === 'exit') {
      done = true
      continue
    }
    const context = createExecutionContext('chat', provider)
    const response = await coordinator.routeChat(userInput, context, 'direct')
    lines.push(`you: ${userInput}`)
    lines.push(`assistant: ${response}`)
  }

  rl.close()
}
