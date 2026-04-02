export type ToolContext = {
  sessionId: string
  cwd: string
}

export type ToolResult = {
  output: string
}

export interface Tool {
  name: string
  description: string
  execute(input: string, context: ToolContext): Promise<ToolResult>
}
