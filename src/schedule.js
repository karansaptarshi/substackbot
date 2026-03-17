#!/usr/bin/env node

import cron from 'node-cron';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const runPath = join(__dirname, 'run.js');

// Run every day at 9:00 AM (local time)
const CRON = '0 9 * * *';

function runJob() {
  const child = spawn(process.execPath, [runPath], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
  });
  child.on('close', (code) => {
    if (code !== 0) console.error('Run exited with code', code);
  });
}

console.log('Substack Quote Bot — daily scheduler (runs at 9:00 AM every day). Press Ctrl+C to stop.');
cron.schedule(CRON, runJob);

// Optional: run once on start (comment out if you only want 9 AM)
// runJob();
