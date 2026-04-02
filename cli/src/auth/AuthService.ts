import crypto from 'node:crypto'
import { exec } from 'node:child_process'
import { loadConfig, saveConfig } from '../config/ConfigService.js'

function openBrowser(url: string): void {
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`
  void exec(command)
}

export class AuthService {
  async login(): Promise<{ verificationUri: string; deviceCode: string }> {
    const deviceCode = crypto.randomBytes(3).toString('hex').toUpperCase()
    const verificationUri = 'https://auth.imrabo.dev/device'
    openBrowser(verificationUri)
    return { verificationUri, deviceCode }
  }

  async saveToken(token: string): Promise<void> {
    const config = await loadConfig()
    config.authToken = token
    await saveConfig(config)
  }

  async logout(): Promise<void> {
    const config = await loadConfig()
    delete config.authToken
    await saveConfig(config)
  }

  async status(): Promise<'logged_in' | 'logged_out'> {
    const config = await loadConfig()
    return config.authToken ? 'logged_in' : 'logged_out'
  }
}
