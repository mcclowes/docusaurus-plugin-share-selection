// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const { scripts } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { scripts: Record<string, string> };
const npmCli = process.env.npm_execpath;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

const helpers = [
  {
    name: 'start',
    command: 'start',
    defaults: [],
    options: ['--port', '4317', '--host', '127.0.0.1'],
  },
  {
    name: 'build',
    command: 'build',
    defaults: [],
    options: ['--out-dir', 'output with spaces', '--config', 'config with spaces.mjs'],
  },
  {
    name: 'serve',
    command: 'serve',
    defaults: [],
    options: ['--port', '4317', '--dir', 'output with spaces'],
  },
];

describe.each(helpers)('example:$name', ({ name, command, defaults, options }) => {
  it.each([{ args: [] }, { args: options }])(
    'forwards arguments $args',
    ({ args }) => {
      expect(npmCli, 'Run helper tests through npm.').toBeTruthy();
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'share selection example helpers ')));
      try {
        const example = join(root, 'examples', 'docusaurus-v3');
        mkdirSync(example, { recursive: true });
        const script = `example:${name}`;
        expect(scripts[script]).toMatch(/^npm /);
        // Exercise both npm layers without invoking personal npm command wrappers.
        const helper = scripts[script].replace(
          /^npm /,
          `${quote(process.execPath)} ${quote(npmCli!)} `
        );
        writeFileSync(
          join(root, 'package.json'),
          JSON.stringify({ private: true, scripts: { [script]: helper } })
        );
        writeFileSync(
          join(example, 'package.json'),
          JSON.stringify({
            private: true,
            scripts: { [command]: `${quote(process.execPath)} record-args.cjs` },
          })
        );
        writeFileSync(
          join(example, 'record-args.cjs'),
          'console.log("fixture-argv:" + JSON.stringify({cwd:process.cwd(), args:process.argv.slice(2)}));'
        );
        const result = spawnSync(
          process.execPath,
          [npmCli!, '--silent', 'run', script, '--', ...args],
          {
            cwd: root,
            encoding: 'utf8',
            timeout: 10_000,
          }
        );
        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
        const record = result.stdout.split('\n').find(line => line.startsWith('fixture-argv:'));
        expect(record, result.stdout + result.stderr).toBeTruthy();
        expect(JSON.parse(record!.slice('fixture-argv:'.length))).toEqual({
          cwd: example,
          args: [...defaults, ...args],
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    15_000
  );
});
