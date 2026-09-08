import * as core from '@actions/core';
import { run, type RunDeps } from './run.js';
import { createClient, realTimers } from './api/client.js';

async function main(): Promise<void> {
  const deps: RunDeps = {
    getInput: (name) => core.getInput(name),
    setOutput: (name, value) => core.setOutput(name, value),
    setFailed: (message) => core.setFailed(message),
    info: (message) => core.info(message),
    warning: (message) => core.warning(message),
    debug: (message) => core.debug(message),
    setSecret: (secret) => core.setSecret(secret),
    createClient: (token) => createClient(token),
    now: () => realTimers.now(),
    workspace: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    env: process.env,
  };
  await run(deps);
}

void main();
