import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { Tool } from '../Tool.js'

const execAsync = promisify(exec)

export const ShellTool: Tool = {
  name: 'shell.exec',
  description: 'Execute a shell command in the current workspace',
  async execute(input, context) {
    const { stdout, stderr } = await execAsync(input, { cwd: context.cwd })
    return { output: stdout || stderr }
  },
}
