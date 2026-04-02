import type { Tool } from '../Tool.js'

export const WebFetchTool: Tool = {
  name: 'web.fetch',
  description: 'Fetch a URL and return text content',
  async execute(input) {
    const response = await fetch(input)
    const text = await response.text()
    return { output: text.slice(0, 4000) }
  },
}
