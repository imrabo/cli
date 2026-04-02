import type { ChatMessage } from '../shared/types.js'

export class SessionMemory {
  private readonly messages: ChatMessage[] = []

  add(message: ChatMessage): void {
    this.messages.push(message)
  }

  all(): ChatMessage[] {
    return [...this.messages]
  }
}
