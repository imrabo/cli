import { Command } from 'commander'
import { AuthService } from '../auth/AuthService.js'
import { createExecutionContext } from '../coordinator/ExecutionContext.js'
import type { Coordinator } from '../coordinator/Coordinator.js'
import type { PluginHost } from '../plugins/PluginHost.js'
import type { ProviderRegistry } from '../providers/ProviderRegistry.js'
import type { SkillExecutor } from '../skills/SkillExecutor.js'
import type { SkillRegistry } from '../skills/SkillRegistry.js'
import type { ToolRegistry } from '../tools/ToolRegistry.js'
import { startInteractiveChat } from '../cli/interactive.js'
import { runNonInteractiveChat } from '../cli/nonInteractive.js'
import { loadConfig, saveConfig, getConfigPath } from '../config/ConfigService.js'

export function registerCommands(program: Command, deps: {
  coordinator: Coordinator
  providerRegistry: ProviderRegistry
  skillRegistry: SkillRegistry
  skillExecutor: SkillExecutor
  toolRegistry: ToolRegistry
  pluginHost: PluginHost
}): void {
  const auth = new AuthService()

  const chat = program.command('chat').description('Interactive and non-interactive chat commands')
  chat
    .argument('[prompt]', 'Prompt for one-shot mode')
    .option('--provider <target>', 'local, remote, or auto', 'auto')
    .action(async (prompt: string | undefined, options: { provider: 'local' | 'remote' | 'auto' }) => {
      if (prompt) {
        const response = await runNonInteractiveChat(deps.coordinator, prompt, options.provider)
        process.stdout.write(`${response}\n`)
        return
      }
      await startInteractiveChat(deps.coordinator, options.provider)
    })

  const agent = program.command('agent').description('Agent workflows')
  agent
    .command('run')
    .argument('<goal>', 'Goal for the agent to execute')
    .option('--provider <target>', 'local, remote, or auto', 'auto')
    .action(async (goal: string, options: { provider: 'local' | 'remote' | 'auto' }) => {
      const context = createExecutionContext('agent', options.provider)
      const output = await deps.coordinator.executeAgent(goal, context)
      process.stdout.write(`${output}\n`)
    })

  const tool = program.command('tool').description('Tool operations')
  tool.command('list').action(() => {
    for (const item of deps.toolRegistry.list()) {
      process.stdout.write(`${item.name} - ${item.description}\n`)
    }
  })

  const model = program.command('model').description('Model discovery commands')
  model.command('list').action(async () => {
    for (const provider of deps.providerRegistry.list()) {
      const models = await provider.models()
      process.stdout.write(`${provider.name}: ${models.map(m => m.id).join(', ') || 'none'}\n`)
    }
  })

  const provider = program.command('provider').description('Provider health and listing')
  provider.command('list').action(async () => {
    for (const item of deps.providerRegistry.list()) {
      const status = await item.health()
      process.stdout.write(`${item.name}: ${status.healthy ? 'healthy' : 'unhealthy'}\n`)
    }
  })

  const plugin = program.command('plugin').description('Plugin operations')
  plugin.command('list').action(() => {
    for (const item of deps.pluginHost.list()) {
      process.stdout.write(`${item.name}@${item.version} [${item.capabilities.join(', ')}]\n`)
    }
  })

  program
    .command('login')
    .description('Browser-based login (device flow)')
    .option('--token <token>', 'Token captured from your auth callback')
    .action(async (options: { token?: string }) => {
      const flow = await auth.login()
      process.stdout.write(`Open: ${flow.verificationUri}\n`)
      process.stdout.write(`Code: ${flow.deviceCode}\n`)
      if (options.token) {
        await auth.saveToken(options.token)
        process.stdout.write('Token stored in ~/.imrabo/config.json\n')
      }
    })

  program.command('auth').description('Authentication status').action(async () => {
    const status = await auth.status()
    process.stdout.write(`${status}\n`)
  })

  program.command('doctor').description('Platform diagnostics').action(async () => {
    process.stdout.write('imrabo doctor\n')
    process.stdout.write(`providers: ${deps.providerRegistry.list().length}\n`)
    process.stdout.write(`tools: ${deps.toolRegistry.list().length}\n`)
    process.stdout.write(`skills: ${deps.skillRegistry.list().length}\n`)
    process.stdout.write(`plugins: ${deps.pluginHost.list().length}\n`)
  })

  const config = program.command('config').description('Configuration management')
  config.command('path').action(() => {
    process.stdout.write(`${getConfigPath()}\n`)
  })
  config.command('get').argument('<key>').action(async (key: string) => {
    const cfg = await loadConfig()
    const value = (cfg as Record<string, unknown>)[key]
    process.stdout.write(`${JSON.stringify(value)}\n`)
  })
  config.command('set').argument('<key>').argument('<value>').action(async (key: string, value: string) => {
    const cfg = await loadConfig()
    ;(cfg as Record<string, unknown>)[key] = value
    await saveConfig(cfg)
    process.stdout.write('ok\n')
  })

  const skill = program.command('skill').description('Skill registry and execution')
  skill.command('list').action(() => {
    for (const item of deps.skillRegistry.list()) {
      process.stdout.write(`${item.name} [${item.tags.join(', ')}] - ${item.description}\n`)
    }
  })

  skill.command('describe').argument('<name>').action((name: string) => {
    const item = deps.skillRegistry.get(name)
    if (!item) {
      throw new Error(`Skill not found: ${name}`)
    }
    process.stdout.write(`${item.name}\n${item.description}\n${item.tags.join(', ')}\n`)
  })

  skill
    .command('run')
    .argument('<name>')
    .option('--input <text>', 'Input for skill execution', '')
    .option('--provider <target>', 'local, remote, or auto', 'auto')
    .action(async (name: string, options: { input: string; provider: 'local' | 'remote' | 'auto' }) => {
      const context = createExecutionContext('skill', options.provider)
      const result = await deps.skillExecutor.execute(name, options.input, context)
      process.stdout.write(`${result.summary}\n`)
    })
}
