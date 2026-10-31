/**
 * Copyright 2026 The AI Crew Suite Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

/** A PID paired with its operating-system creation time to detect PID reuse. */
export interface ProcessIdentity {
  pid: number;
  started: string;
}

interface ProcessRecord extends ProcessIdentity {
  parent: number;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ESRCH');
}

function linuxProcesses(): ProcessRecord[] {
  const records: ProcessRecord[] = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (fields[0] === 'Z') continue;
      const parent = Number(fields[1]);
      const started = fields[19];
      if (started && Number.isSafeInteger(parent)) records.push({ pid: Number(entry), parent, started });
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return records;
}

function macProcesses(): ProcessRecord[] {
  const output = execFileSync('ps', ['-axo', 'pid=,ppid=,lstart='], {
    encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' },
  });
  return output.split('\n').filter(Boolean).map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    if (!match) throw new Error('Unable to parse the macOS process table.');
    return { pid: Number(match[1]), parent: Number(match[2]), started: match[3]! };
  });
}

function windowsProcesses(): ProcessRecord[] {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '@(Get-CimInstance Win32_Process | ForEach-Object {',
    '  @{ pid = [int]$_.ProcessId; parent = [int]$_.ParentProcessId;',
    '     started = $_.CreationDate.ToUniversalTime().ToString("o") }',
    '}) | ConvertTo-Json -Compress',
  ].join('\n');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true,
  });
  const records: unknown = JSON.parse(output);
  if (!Array.isArray(records) || !records.every(record =>
    typeof record === 'object' && record !== null
    && Number.isSafeInteger(record.pid) && Number.isSafeInteger(record.parent)
    && typeof record.started === 'string')) {
    throw new Error('Unable to parse the Windows process table.');
  }
  return records;
}

function listProcesses(): ProcessRecord[] {
  if (process.platform === 'linux') return linuxProcesses();
  if (process.platform === 'darwin') return macProcesses();
  if (process.platform === 'win32') return windowsProcesses();
  throw new Error(`Unsupported process management platform: ${process.platform}`);
}

/** Looks up a process without treating a reused PID as the original process. */
export function processIdentity(pid: number): ProcessIdentity | undefined {
  const found = listProcesses().find(record => record.pid === pid);
  return found && { pid: found.pid, started: found.started };
}

/** Returns whether the recorded process is still the same OS process. */
export function isSameProcess(identity: ProcessIdentity): boolean {
  return processIdentity(identity.pid)?.started === identity.started;
}

/**
 * Terminates only the identified process and descendants observed beneath it.
 * Each PID is rechecked against its creation time immediately before signalling.
 */
export function terminateProcessTree(identity: ProcessIdentity, signal: NodeJS.Signals = 'SIGTERM'): void {
  const records = listProcesses();
  if (!records.some(record => record.pid === identity.pid && record.started === identity.started)) return;
  const descendants: ProcessRecord[] = [];
  const visit = (parent: number) => {
    for (const child of records.filter(record => record.parent === parent && record.pid !== parent)) {
      descendants.push(child);
      visit(child.pid);
    }
  };
  visit(identity.pid);
  if ([identity, ...descendants].some(target => target.pid === process.pid)) {
    throw new Error('Refusing to terminate the current workbench CLI process.');
  }
  for (const target of [identity, ...descendants.reverse()]) {
    if (!isSameProcess(target)) continue;
    try {
      process.kill(target.pid, signal);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}
