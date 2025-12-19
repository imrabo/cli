import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import axios from 'axios';
import os from 'os';
import semver from 'semver';

// Since we are refactoring to TS, we can't easily require package.json if it's outside src or if not configured.
// We'll use a safer way to get the version.
const packageJson = require('../../package.json');

const APP_DATA = process.env.LOCALAPPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.local', 'share'));
const STATE_FILE = path.join(APP_DATA, 'imrabo', 'state.json');

export interface RuntimeState {
    pid: number;
    port: string;
    token: string;
    version?: string;
}

export async function getRuntimeState(): Promise<RuntimeState | null> {
    try {
        if (!(await fs.pathExists(STATE_FILE))) return null;
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

export async function checkHealth(): Promise<boolean> {
    const state = await getRuntimeState();
    if (!state || !state.port) return false;

    try {
        const response = await axios.get(`http://127.0.0.1:${state.port}/status`, {
            timeout: 2000,
            headers: { 'X-Imrabo-Token': state.token }
        });

        // Check version compatibility
        const runtimeVersion = response.data.version;
        if (runtimeVersion && !semver.satisfies(runtimeVersion, `^${packageJson.version}`)) {
            console.warn(`[WARN] Version mismatch: CLI is ${packageJson.version}, Runtime is ${runtimeVersion}. Update recommended.`);
        }

        return response.data.status === 'READY' || response.data.status === 'BUSY';
    } catch (error) {
        return false;
    }
}

export async function startRuntime(): Promise<void> {
    console.log('Starting imrabo runtime...');

    // Check for binary in PATH first
    let runtimeCmd = 'imrabo-runtime';
    let runtimeArgs: string[] = [];
    let cwd = process.cwd();

    // Fallback to dev mode if binary not found
    const devPath = path.join(__dirname, '../../../runtime/cmd/main.go');
    if (await fs.pathExists(devPath)) {
        runtimeCmd = 'go';
        runtimeArgs = ['run', 'cmd/main.go'];
        cwd = path.join(__dirname, '../../../runtime');
    }

    const subprocess = execa(runtimeCmd, runtimeArgs, {
        cwd: cwd,
        detached: true,
        stdio: 'ignore',
        shell: true,
        env: {
            ...process.env,
            Path: (process.env.Path || '') + ';C:\\Program Files\\Go\\bin'
        }
    });

    subprocess.unref();

    // Wait for health check to pass
    let retries = 60; // 30 seconds
    while (retries > 0) {
        if (await checkHealth()) return;
        await new Promise(resolve => setTimeout(resolve, 500));
        retries--;
    }

    throw new Error('Timed out waiting for runtime to start');
}

export async function stopRuntime(): Promise<void> {
    const state = await getRuntimeState();
    if (!state || !state.port) return;

    try {
        await axios.post(`http://127.0.0.1:${state.port}/shutdown`, {}, {
            timeout: 2000,
            headers: { 'X-Imrabo-Token': state.token }
        });
        // Wait a bit for it to exit gracefully
        await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
        // If shutdown endpoint fails or times out, force kill PID
        try {
            if (os.platform() === 'win32') {
                await execa('taskkill', ['/F', '/PID', state.pid.toString()]);
            } else {
                process.kill(state.pid, 'SIGKILL');
            }
        } catch (killError) { }
    }

    try {
        await fs.remove(STATE_FILE);
        const lockFile = path.join(path.dirname(STATE_FILE), 'imrabo.lock');
        if (await fs.pathExists(lockFile)) {
            await fs.remove(lockFile);
        }
    } catch (error: any) {
        if (error.code !== 'EBUSY') throw error;
    }
}

export function normalizeError(error: any): string {
    if (error.response) {
        const status = error.response.status;
        if (status === 429) return 'imrabo is busy processing another request.';
        if (status === 503) return 'imrabo runtime is currently initializing.';
        if (status === 500) return `imrabo runtime error: ${error.response.data || 'Internal Error'}`;
        return `imrabo error (${status}): ${error.response.data}`;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return 'imrabo runtime is not responding. Try "imrabo restart".';
    }
    return `imrabo encountered an unexpected error: ${error.message}`;
}
