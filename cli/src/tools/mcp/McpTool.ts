import type { Tool } from '../Tool.js'

export const McpTool: Tool = {
  name: 'mcp.invoke',
  description: 'Invoke MCP-connected capability (stub bridge)',
  async execute(input) {
    return { output: `MCP invocation accepted: ${input}` }
  },
}
