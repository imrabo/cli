import { AgentEngine } from './agents/AgentEngine.js'
import { loadConfig } from './config/ConfigService.js'
import { Coordinator } from './coordinator/Coordinator.js'
import { PluginHost } from './plugins/PluginHost.js'
import { PolicyEngine } from './policy/PolicyEngine.js'
import { ProviderGateway } from './providers/ProviderGateway.js'
import { ProviderRegistry } from './providers/ProviderRegistry.js'
import { LMStudioProvider } from './providers/local/LMStudioProvider.js'
import { OllamaProvider } from './providers/local/OllamaProvider.js'
import { OpenAIProvider } from './providers/remote/OpenAIProvider.js'
import { ProviderSelector } from './providers/selection/ProviderSelector.js'
import { SkillExecutor } from './skills/SkillExecutor.js'
import { SkillRegistry } from './skills/SkillRegistry.js'
import { analyzeLogsSkill } from './skills/builtins/analyzeLogsSkill.js'
import { codeReviewSkill } from './skills/builtins/codeReviewSkill.js'
import { debugErrorSkill } from './skills/builtins/debugErrorSkill.js'
import { generateApiSkill } from './skills/builtins/generateApiSkill.js'
import { refactorCodeSkill } from './skills/builtins/refactorCodeSkill.js'
import { writeTestsSkill } from './skills/builtins/writeTestsSkill.js'
import { ToolExecutor } from './tools/ToolExecutor.js'
import { ToolRegistry } from './tools/ToolRegistry.js'
import { FileReadTool } from './tools/fs/FileReadTool.js'
import { McpTool } from './tools/mcp/McpTool.js'
import { PermissionGateway } from './tools/permissions/PermissionGateway.js'
import { ShellTool } from './tools/shell/ShellTool.js'
import { WebFetchTool } from './tools/web/WebFetchTool.js'

export async function createPlatform() {
  const config = await loadConfig()

  const providerRegistry = new ProviderRegistry()
  providerRegistry.register(new OllamaProvider())
  providerRegistry.register(new LMStudioProvider())
  providerRegistry.register(new OpenAIProvider(config.authToken))

  const policy = new PolicyEngine(providerRegistry, config.policy)

  const selector = new ProviderSelector(providerRegistry, policy)
  const providerGateway = new ProviderGateway(providerRegistry, selector)

  const toolRegistry = new ToolRegistry()
  toolRegistry.register(FileReadTool)
  toolRegistry.register(ShellTool)
  toolRegistry.register(WebFetchTool)
  toolRegistry.register(McpTool)

  const permissions = new PermissionGateway(true)
  const toolExecutor = new ToolExecutor(toolRegistry, permissions)

  const skillRegistry = new SkillRegistry()
  skillRegistry.register(codeReviewSkill)
  skillRegistry.register(debugErrorSkill)
  skillRegistry.register(generateApiSkill)
  skillRegistry.register(refactorCodeSkill)
  skillRegistry.register(analyzeLogsSkill)
  skillRegistry.register(writeTestsSkill)

  let askModel: ((prompt: string, context: Parameters<Coordinator['requestModel']>[1]) => Promise<string>) | undefined
  const skillExecutor = new SkillExecutor(skillRegistry, toolExecutor, (prompt, context) => {
    if (!askModel) {
      throw new Error('Coordinator is not initialized')
    }
    return askModel(prompt, context)
  })

  const agentEngine = new AgentEngine(skillExecutor)

  const coordinator = new Coordinator({
    providerGateway,
    policy,
    runAgent: (goal, context) => agentEngine.run(goal, context),
  })

  askModel = (prompt, context) => coordinator.requestModel(prompt, context)

  const pluginHost = new PluginHost()
  pluginHost.register({
    name: 'builtin-core',
    version: '1.0.0',
    capabilities: ['command', 'skill', 'tool'],
  })

  return {
    coordinator,
    providerRegistry,
    skillRegistry,
    skillExecutor,
    toolRegistry,
    pluginHost,
  }
}
