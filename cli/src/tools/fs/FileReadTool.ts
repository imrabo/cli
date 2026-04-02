import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Tool } from '../Tool.js'

export const FileReadTool: Tool = {
  name: 'file.read',
  description: 'Read a text file from the working directory',
  async execute(input, context) {
    const filePath = path.resolve(context.cwd, input)
    const content = await fs.readFile(filePath, 'utf8')
    return { output: content }
  },
}
