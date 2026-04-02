import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type ImraboConfig = {
  authToken?: string
  defaultProvider?: string
  remoteProvider?: string
  localProviders?: string[]
  policy?: {
    defaultProvider?: 'local' | 'remote' | 'auto'
    fallbackProvider?: 'local' | 'remote'
    allowFallback?: boolean
    maxCost?: 'low' | 'medium' | 'high'
    maxRetries?: number
  }
}

const CONFIG_DIR = path.join(os.homedir(), '.imrabo')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

export async function loadConfig(): Promise<ImraboConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    return JSON.parse(raw) as ImraboConfig
  } catch {
    return {}
  }
}

export async function saveConfig(config: ImraboConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

export function getConfigPath(): string {
  return CONFIG_PATH
}
