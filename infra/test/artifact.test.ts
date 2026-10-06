import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { test } from 'node:test';
import { verifyBackendArtifact } from '../lib/backend/artifact';

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hireflux-artifact-verifier-'));
  mkdirSync(join(root, 'backend/src/hireflux_backend'), { recursive: true });
  mkdirSync(join(root, 'artifacts/lambda'), { recursive: true });
  writeFileSync(join(root, 'backend/uv.lock'), 'fixture lock');
  writeFileSync(join(root, 'backend/pyproject.toml'), 'fixture project');
  writeFileSync(join(root, 'backend/src/hireflux_backend/lambda_handler.py'), 'handler = None\r\n');
  const entries = ['boto3/__init__.py', 'botocore/__init__.py', 'fastapi/__init__.py',
    'hireflux_backend/lambda_handler.py', 'mangum/__init__.py'].map((path) => ({
      path, bytes: Buffer.from(path.startsWith('hireflux_backend/') ? 'handler = None\n' : '# fixture\n'),
    }));
  const localParts: Buffer[] = []; const directory: Buffer[] = []; let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path); const local = Buffer.alloc(30); const central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(33, 12);
    local.writeUInt32LE(entry.bytes.length, 18); local.writeUInt32LE(entry.bytes.length, 22); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(788, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(33, 14); central.writeUInt32LE(entry.bytes.length, 20); central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE((0o100644 * 65536) >>> 0, 38); central.writeUInt32LE(offset, 42);
    localParts.push(local, name, entry.bytes); directory.push(central, name); offset += 30 + name.length + entry.bytes.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(Buffer.concat(directory).length, 12); end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...localParts, ...directory, end]);
  const manifest: Record<string, any> = {
    schema_version: 1, runtime: 'python3.14', architecture: 'x86_64', wheel_platform: 'x86_64-manylinux_2_34',
    handler: 'hireflux_backend.lambda_handler.handler', uv_version: '0.12.5',
    lock_sha256: hash(readFileSync(join(root, 'backend/uv.lock'))), project_sha256: hash(readFileSync(join(root, 'backend/pyproject.toml'))),
    sha256: hash(zip), compressed_bytes: zip.length, expanded_bytes: entries.reduce((sum, entry) => sum + entry.bytes.length, 0),
    file_count: entries.length, files: entries.map((entry) => ({ path: entry.path, bytes: entry.bytes.length, sha256: hash(entry.bytes) })),
  };
  const path = join(root, 'artifacts/lambda/hireflux-backend-lambda.zip');
  const manifestPath = path.replace(/\.zip$/, '.manifest.json');
  writeFileSync(path, zip); writeFileSync(manifestPath, JSON.stringify(manifest));
  return { root, path, manifestPath, manifest };
}
function cleanup(root: string) {
  const within = relative(tmpdir(), root);
  assert.ok(within && !within.startsWith('..') && !isAbsolute(within));
  rmSync(root, { recursive: true, force: true });
}

test('verified prebuilt artifact binds manifest, ZIP inventory and normalized current source without Python', () => {
  const sample = fixture();
  try { assert.deepEqual(verifyBackendArtifact(sample.root), { path: sample.path, sha256: sample.manifest.sha256 }); }
  finally { cleanup(sample.root); }
});
for (const [name, mutate] of Object.entries({
  runtime: (sample: ReturnType<typeof fixture>) => { sample.manifest.runtime = 'python3.13'; },
  architecture: (sample: ReturnType<typeof fixture>) => { sample.manifest.architecture = 'arm64'; },
  handler: (sample: ReturnType<typeof fixture>) => { sample.manifest.handler = 'other.handler'; },
  sha256: (sample: ReturnType<typeof fixture>) => { sample.manifest.sha256 = '0'.repeat(64); },
  budget: (sample: ReturnType<typeof fixture>) => { sample.manifest.expanded_bytes = 201 * 1024 * 1024; },
  count: (sample: ReturnType<typeof fixture>) => { sample.manifest.file_count = 2; },
  inventory: (sample: ReturnType<typeof fixture>) => { sample.manifest.files[0].sha256 = '0'.repeat(64); },
  lock: (sample: ReturnType<typeof fixture>) => { writeFileSync(join(sample.root, 'backend/uv.lock'), 'changed'); },
  project: (sample: ReturnType<typeof fixture>) => { writeFileSync(join(sample.root, 'backend/pyproject.toml'), 'changed'); },
  source: (sample: ReturnType<typeof fixture>) => { writeFileSync(join(sample.root, 'backend/src/hireflux_backend/lambda_handler.py'), 'changed'); },
  extraSource: (sample: ReturnType<typeof fixture>) => { writeFileSync(join(sample.root, 'backend/src/hireflux_backend/new.py'), 'changed'); },
  arbitraryZip: (sample: ReturnType<typeof fixture>) => { writeFileSync(sample.path, 'not a ZIP'); },
})) {
  test(`artifact verification rejects ${name} drift with an explicit rebuild diagnostic`, () => {
    const sample = fixture();
    try {
      mutate(sample); writeFileSync(sample.manifestPath, JSON.stringify(sample.manifest));
      assert.throws(() => verifyBackendArtifact(sample.root), /Lambda artifact verification failed:.*Build explicitly/);
    } finally { cleanup(sample.root); }
  });
}

test('missing real ZIP or manifest never substitutes source or a dummy asset', () => {
  const sample = fixture();
  try {
    rmSync(sample.manifestPath);
    assert.throws(() => verifyBackendArtifact(sample.root), /ZIP and adjacent manifest/);
    rmSync(sample.path);
    assert.throws(() => verifyBackendArtifact(sample.root), /ZIP and adjacent manifest/);
  } finally { cleanup(sample.root); }
});
