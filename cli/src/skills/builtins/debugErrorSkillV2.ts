import type { Skill } from '../Skill.js'

/**
 * Real multi-step skill: Debug Error
 * 
 * Workflow:
 * 1. Parse error message and extract filename/line if possible
 * 2. Try to read the code file (using file.read tool)
 * 3. Get model analysis of the error
 * 4. Suggest concrete fixes with code examples
 */
export const debugErrorSkillV2: Skill = {
  name: 'debug_error_skill',
  description: 'Analyze errors and suggest fixes with code context',
  tags: ['debugging', 'analysis', 'multi-step'],

  async execute(input, context) {
    try {
      // Step 1: Parse error to extract file/line info
      const errorInfo = parseErrorMessage(input)

      let codeContext = ''

      // Step 2: Attempt to read code file if mentioned
      if (errorInfo.filename) {
        try {
          codeContext = await context.runTool('file.read', errorInfo.filename)
        } catch {
          // File read failed, proceed with just error message
        }
      }

      // Step 3: Ask model for analysis with code context
      const analysisPrompt = buildAnalysisPrompt(input, codeContext, errorInfo)
      const analysis = await context.askModel(analysisPrompt)

      // Step 4: Generate fix suggestions
      const fixPrompt = `Based on this analysis:\n${analysis}\n\nProvide concrete fix suggestions with code examples:\n${errorInfo.error}`
      const fixes = await context.askModel(fixPrompt)

      return {
        summary: `Error Analysis:\n${analysis}\n\nSuggested Fixes:\n${fixes}`,
        data: {
          error: errorInfo.error,
          filename: errorInfo.filename,
          line: errorInfo.line,
          type: errorInfo.type,
          analysis: analysis.slice(0, 500), // Truncate
          fixes: fixes.slice(0, 500),
        },
        nextStep: 'apply_fix', // Optional next step for agent
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return {
        summary: `Error analysis failed: ${msg}`,
        error: msg,
      }
    }
  },
}

interface ErrorInfo {
  error: string
  filename?: string
  line?: number
  type?: string
}

/**
 * Parse error message to extract useful context
 */
function parseErrorMessage(errorMsg: string): ErrorInfo {
  const result: ErrorInfo = { error: errorMsg }

  // Try to extract filename (common patterns)
  const fileMatch = errorMsg.match(/(?:file|at|in)\s+([/\\.\w-]+\.(?:\w+))/i)
  if (fileMatch) {
    result.filename = fileMatch[1] ?? 'unknown'
  }

  // Try to extract line number
  const lineMatch = errorMsg.match(/(?:line|L|:)(\d+)/i)
  if (lineMatch) {
    result.line = parseInt(lineMatch[1] ?? '0', 10)
  }

  // Try to identify error type
  if (errorMsg.includes('TypeError')) result.type = 'TypeError'
  else if (errorMsg.includes('ReferenceError')) result.type = 'ReferenceError'
  else if (errorMsg.includes('SyntaxError')) result.type = 'SyntaxError'
  else if (errorMsg.includes('cannot find module')) result.type = 'ModuleNotFound'
  else if (errorMsg.includes('econnrefused')) result.type = 'ConnectionError'
  else if (errorMsg.includes('timeout')) result.type = 'TimeoutError'
  else result.type = 'UnknownError'

  return result
}

/**
 * Build prompt for model analysis
 */
function buildAnalysisPrompt(
  errorMsg: string,
  codeContext: string,
  errorInfo: ErrorInfo,
): string {
  let prompt = `Analyze this error and provide root cause analysis:\n\nError:\n${errorMsg}`

  if (errorInfo.type) {
    prompt += `\n\nError Type: ${errorInfo.type}`
  }

  if (codeContext) {
    prompt += `\n\nRelevant Code:\n\`\`\`\n${codeContext.slice(0, 1000)}\n\`\`\``
  }

  prompt += '\n\nProvide:1. Root cause explanation'
  prompt += '\n2. Why this error occurs'
  prompt += '\n3. Common scenarios that trigger this'

  return prompt
}
