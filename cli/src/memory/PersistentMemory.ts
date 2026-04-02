import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const MEMORY_PATH = path.join(os.homedir(), '.imrabo', 'memory.json')

export class PersistentMemory {
  async load(): Promise<string[]> {
    try {
      const raw = await fs.readFile(MEMORY_PATH, 'utf8')
      return JSON.parse(raw) as string[]
    } catch {
      return []
    }
  }

  async append(entry: string): Promise<void> {
    const existing = await this.load()
    existing.push(entry)
    await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true })
    await fs.writeFile(MEMORY_PATH, JSON.stringify(existing, null, 2), 'utf8')
  }
}
