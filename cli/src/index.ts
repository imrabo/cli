#!/usr/bin/env node
import { Command } from 'commander'
import fs from 'fs-extra'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPlatform } from './bootstrap.js'
import { registerCommands } from './commands/registerCommands.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJson = fs.readJsonSync(path.join(__dirname, '../package.json')) as {
    version: string
}

async function main(): Promise<void> {
    const platform = await createPlatform()

    const program = new Command()
    program
    .name('imrabo')
      .description('Unified AI CLI with coordinator, skills, tools, and provider routing')
      .version(packageJson.version)

    registerCommands(program, platform)

    await program.parseAsync(process.argv)
}

void main()
