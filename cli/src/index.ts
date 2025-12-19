#!/usr/bin/env node
import { Command } from 'commander';
import { checkHealth, startRuntime, stopRuntime, getRuntimeState, normalizeError } from './utils/runtime';
import axios from 'axios';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

// @ts-ignore
import packageJson from '../package.json';

const program = new Command();

program
    .name('imrabo')
    .description('Local AI runtime platform controlled by a thin CLI')
    .version(packageJson.version);

program
    .command('start')
    .description('Start the imrabo runtime if not running')
    .action(async () => {
        if (await checkHealth()) {
            console.log('imrabo runtime is already running');
        } else {
            await startRuntime();
            console.log('imrabo runtime started');
        }
    });

program
    .command('restart')
    .description('Restart the imrabo runtime')
    .action(async () => {
        console.log('Restarting imrabo runtime...');
        await stopRuntime();
        await startRuntime();
        console.log('imrabo runtime restarted');
    });

program
    .command('version')
    .description('Show imrabo CLI and Runtime versions')
    .action(async () => {
        console.log(`imrabo CLI: ${packageJson.version}`);

        const state = await getRuntimeState();
        if (state && state.port) {
            try {
                const response = await axios.get(`http://127.0.0.1:${state.port}/status`, {
                    headers: { 'X-Imrabo-Token': state.token },
                    timeout: 1000
                });
                console.log(`imrabo Runtime: ${response.data.version || 'unknown'}`);
            } catch (error) {
                console.log('imrabo Runtime: (unreachable)');
            }
        } else {
            console.log('imrabo Runtime: (not running)');
        }
    });

program
    .command('run')
    .argument('<input>', 'Input to process')
    .description('Run a model with the given input')
    .action(async (input: string) => {
        try {
            if (!(await checkHealth())) {
                await startRuntime();
            }

            const state = await getRuntimeState();
            if (!state) throw new Error('Could not retrieve runtime state');

            try {
                const response = await axios.post(`http://127.0.0.1:${state.port}/run`, { input }, {
                    timeout: 30000,
                    headers: { 'X-Imrabo-Token': state.token }
                });
                console.log(response.data.output || response.data);
            } catch (error) {
                console.error(normalizeError(error));
                process.exit(1);
            }
        } catch (error: any) {
            console.error(`Error: ${error.message}`);
            process.exit(1)
        }
    });

program
    .command('doctor')
    .description('Run diagnostics to check the health of the imrabo platform')
    .action(async () => {
        console.log('imrabo Doctor - Running Diagnostics...\n');

        // 1. Check State File
        const state = await getRuntimeState();
        if (state) {
            console.log(`[PASS] State file found (PID: ${state.pid}, Port: ${state.port})`);
        } else {
            console.log('[FAIL] State file not found. Runtime might not be initialized.');
        }

        // 2. Check Port Reachability & Token Validity
        const isRunning = await checkHealth();
        if (isRunning) {
            console.log('[PASS] Runtime API is reachable');
            if (state && state.token) {
                try {
                    await axios.get(`http://127.0.0.1:${state.port}/status`, {
                        headers: { 'X-Imrabo-Token': state.token },
                        timeout: 1000
                    });
                    console.log('[PASS] API Token is valid');
                } catch (e: any) {
                    console.log(`[FAIL] API Token check failed: ${e.message}`);
                }
            }
        } else {
            console.log('[FAIL] Runtime API is NOT reachable');
        }

        // 3. Check RAM
        const totalRAM = os.totalmem() / (1024 * 1024 * 1024);
        if (totalRAM >= 8) {
            console.log(`[PASS] System RAM: ${totalRAM.toFixed(1)} GB (>= 8GB)`);
        } else {
            console.log(`[WARN] System RAM: ${totalRAM.toFixed(1)} GB (< 8GB required for some models)`);
        }

        // 4. Check Disk Space & Model Cache
        const dataDir = path.join(process.env.LOCALAPPDATA || '', 'imrabo');
        if (await fs.pathExists(dataDir)) {
            console.log(`[PASS] Data directory exists: ${dataDir}`);

            const modelsDir = path.join(dataDir, 'models');
            if (await fs.pathExists(modelsDir)) {
                console.log('[PASS] Model cache directory found');
            } else {
                console.log('[INFO] Model cache is empty');
            }
        } else {
            console.log('[FAIL] Data directory is missing');
        }

        // 5. Binary Presence (Dev mode check)
        const runtimeSource = path.join(__dirname, '../../../runtime/cmd/main.go');
        if (await fs.pathExists(runtimeSource)) {
            console.log('[PASS] Runtime source/binary found (Developer Mode)');
        }

        console.log('\nDiagnostics complete.');
    });

program
    .command('status')
    .description('Check the status of the imrabo runtime')
    .action(async () => {
        const isRunning = await checkHealth();
        if (isRunning) {
            const state = await getRuntimeState();
            if (state) {
                console.log(`imrabo runtime is running (PID: ${state.pid}, Port: ${state.port})`);
            }
        } else {
            console.log('imrabo runtime is not running');
        }
    });

program
    .command('stop')
    .description('Stop the imrabo runtime')
    .action(async () => {
        console.log('Stopping imrabo runtime...');
        await stopRuntime();
        console.log('imrabo runtime stopped');
    });

program.parse(process.argv);
