import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Source inventory excludes stale compiled integration tests after a renamed file.
const tests = readdirSync('test').filter((name) => name.endsWith('.test.ts'))
  .map((name) => `build/test/${name.replace(/\.ts$/, '.js')}`);
const result = spawnSync(process.execPath, ['--require', './build/test/block-network.js', '--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
