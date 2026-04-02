import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { Tool, ToolContext } from '../Tool.js'

const execAsync = promisify(exec)

/**
 * Hardened shell tool with security features:
 * - Command whitelist
 * - Dangerous operation detection
 * - Argument validation
 * - Output size limits
 */
export const SecureShellTool: Tool = {
  name: 'shell.exec',
  description: 'Execute shell commands safely (whitelisted commands only)',

  async execute(input: string, context: ToolContext) {
    // 1. Parse command
    const parts = parseCommand(input)
    if (parts.length === 0) {
      return { output: '' }
    }

    const baseCommand = (parts[0] ?? '').toLowerCase()

    // 2. Whitelist check
    if (!isCommandWhitelisted(baseCommand)) {
      throw new Error(`Command '${baseCommand}' not whitelisted. Allowed: ${getAllowedCommands().join(', ')}`)
    }

    // 3. Dangerous pattern detection
    const fullCommand = input.trim()
    if (containsDangerousPatterns(fullCommand)) {
      throw new Error('Command contains dangerous patterns: no pipes, redirects, or command substitution allowed')
    }

    // 4. Execute with timeout
    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: context.cwd,
        timeout: 10_000,          // 10s timeout
        maxBuffer: 1024 * 1024,   // 1MB output limit
      })

      return { output: stdout || stderr }
    } catch (error) {
      const err = error as Error & { code?: number }
      if (err.code === null) {
        throw new Error(`Command timeout or exceeded output limit`)
      }
      throw error
    }
  },
}

/**
 * Parse shell command into parts
 */
function parseCommand(input: string): string[] {
  const trimmed = input.trim()
  if (!trimmed) return []

  // Simple split on whitespace (not shell-parsing)
  return trimmed.split(/\s+/)
}

/**
 * Whitelist of allowed commands
 */
function getAllowedCommands(): string[] {
  return [
    // Development
    'npm',
    'node',
    'yarn',
    'pnpm',
    'bun',
    'ts-node',
    'tsc',

    // Version control
    'git',

    // Language tools
    'python',
    'python3',
    'ruby',
    'go',
    'rustc',
    'cargo',

    // File utilities (read-only operations)
    'cat',
    'ls',
    'find',
    'grep',
    'head',
    'tail',
    'wc',

    // Info
    'echo',
    'date',
    'whoami',
    'pwd',

    // System (safe queries)
    'uname',
    'which',
  ]
}

/**
 * Check if command is whitelisted
 */
function isCommandWhitelisted(command: string): boolean {
  return getAllowedCommands().includes(command)
}

/**
 * Detect dangerous shell patterns
 */
function containsDangerousPatterns(command: string): boolean {
  const dangerousPatterns = [
    /[;&|`$()]/,              // Pipes, semicolons, command substitution, etc.
    />\s*\//,                 // Output redirection
    /rm\s+-rf/,               // Recursive delete
    /sudo/,                   // Privilege escalation
    /dd\s+if=/,               // Direct disk access
    /\|\s*(?:nc|ncat)/,       // Network tools via pipe
    /\/dev\/zero/,            // Infinite data
    /fork\s*\(\s*\)/,         // Fork bomb pattern
  ]

  return dangerousPatterns.some(pattern => pattern.test(command))
}
