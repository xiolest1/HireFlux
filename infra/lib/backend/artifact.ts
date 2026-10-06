import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export interface BackendArtifact { readonly path: string; readonly sha256: string; }
export const COMPRESSED_LIMIT = 40 * 1024 * 1024;
export const EXPANDED_LIMIT = 200 * 1024 * 1024;
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), 'Invalid artifact manifest object.');
  return value as Record<string, unknown>;
}

/** Inspect the canonical non-ZIP64 ZIP without extracting, running Python or invoking a bundler. */
function zipMembers(zip: Buffer): Map<string, Buffer> {
  const end = zip.length - 22;
  assert.ok(end >= 0 && zip.readUInt32LE(end) === 0x06054b50, 'Invalid canonical ZIP trailer.');
  assert.equal(zip.readUInt16LE(end + 20), 0, 'ZIP comments are not canonical.');
  assert.equal(zip.readUInt32LE(end + 4), 0, 'Multi-disk ZIP is forbidden.');
  const count = zip.readUInt16LE(end + 10);
  assert.ok(count > 0 && count < 65535 && zip.readUInt16LE(end + 8) === count, 'Invalid ZIP member count.');
  let position = zip.readUInt32LE(end + 16);
  assert.equal(position + zip.readUInt32LE(end + 12), end, 'Invalid ZIP directory size.');
  let expanded = 0;
  const result = new Map<string, Buffer>();
  for (let index = 0; index < count; index++) {
    assert.ok(position + 46 <= end && zip.readUInt32LE(position) === 0x02014b50, 'Invalid ZIP directory.');
    const method = zip.readUInt16LE(position + 10);
    assert.equal(zip.readUInt16LE(position + 8), 0, 'Unexpected ZIP flags.');
    assert.equal(zip.readUInt16LE(position + 12), 0, 'Noncanonical ZIP time.');
    assert.equal(zip.readUInt16LE(position + 14), 33, 'Noncanonical ZIP date.');
    const compressed = zip.readUInt32LE(position + 20);
    const size = zip.readUInt32LE(position + 24);
    const nameLength = zip.readUInt16LE(position + 28);
    const extraLength = zip.readUInt16LE(position + 30);
    const commentLength = zip.readUInt16LE(position + 32);
    const local = zip.readUInt32LE(position + 42);
    const name = zip.subarray(position + 46, position + 46 + nameLength).toString('utf8');
    assert.ok(name && !name.startsWith('/') && !name.includes('\\') && !name.includes(':') &&
      name.split('/').every((part) => part && part !== '.' && part !== '..'), 'Unsafe ZIP member.');
    assert.ok(!result.has(name), 'Duplicate ZIP member.');
    assert.equal(zip.readUInt32LE(position + 38) >>> 16, 0o100644, 'Noncanonical ZIP file mode.');
    expanded += size;
    assert.ok(expanded <= EXPANDED_LIMIT, 'Expanded artifact exceeds budget.');
    assert.ok(local + 30 <= position && zip.readUInt32LE(local) === 0x04034b50, 'Invalid local ZIP header.');
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    assert.equal(zip.subarray(local + 30, local + 30 + nameLength).toString('utf8'), name);
    assert.ok(start + compressed <= position && (method === 0 || method === 8), 'Invalid ZIP compression.');
    const payload = zip.subarray(start, start + compressed);
    const bytes = method === 0 ? payload : inflateRawSync(payload, { maxOutputLength: Math.max(1, size) });
    assert.equal(bytes.length, size, 'ZIP member size mismatch.');
    result.set(name, bytes);
    position += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(position, end, 'Unexpected ZIP directory data.');
  assert.deepEqual([...result.keys()], [...result.keys()].sort(), 'ZIP inventory is not sorted.');
  return result;
}

function sources(root: string, prefix = ''): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Symlink in runtime source.');
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      for (const [child, bytes] of sources(join(root, entry.name), `${name}/`)) result.set(child, bytes);
    } else if (entry.name.endsWith('.py')) {
      result.set(`hireflux_backend/${name}`, Buffer.from(readFileSync(join(root, entry.name), 'utf8').replaceAll('\r\n', '\n')));
    }
  }
  return result;
}

export function verifyBackendArtifact(repositoryRoot = resolve(__dirname, '../../../..')): BackendArtifact {
  const path = join(repositoryRoot, 'artifacts/lambda/hireflux-backend-lambda.zip');
  const manifestPath = path.replace(/\.zip$/, '.manifest.json');
  try {
    assert.ok(existsSync(path) && existsSync(manifestPath), 'ZIP and adjacent manifest are required.');
    assert.ok(!lstatSync(path).isSymbolicLink() && !lstatSync(manifestPath).isSymbolicLink(), 'Artifact symlinks are forbidden.');
    assert.ok(lstatSync(path).size <= COMPRESSED_LIMIT, 'Compressed artifact exceeds budget.');
    assert.ok(lstatSync(manifestPath).size < 4 * 1024 * 1024, 'Manifest exceeds budget.');
    const manifest = object(JSON.parse(readFileSync(manifestPath, 'utf8')));
    for (const [key, value] of Object.entries({
      schema_version: 1, runtime: 'python3.14', architecture: 'x86_64',
      wheel_platform: 'x86_64-manylinux_2_34', handler: 'hireflux_backend.lambda_handler.handler', uv_version: '0.12.5',
    })) assert.equal(manifest[key], value, `Invalid artifact ${key}.`);
    assert.equal(manifest.lock_sha256, sha256(readFileSync(join(repositoryRoot, 'backend/uv.lock'))), 'Stale dependency lock.');
    assert.equal(manifest.project_sha256, sha256(readFileSync(join(repositoryRoot, 'backend/pyproject.toml'))), 'Stale project input.');
    const zip = readFileSync(path);
    const hash = sha256(zip);
    assert.equal(manifest.sha256, hash, 'Artifact SHA-256 mismatch.');
    assert.equal(manifest.compressed_bytes, zip.length, 'Compressed size mismatch.');
    const members = zipMembers(zip);
    assert.equal(manifest.file_count, members.size, 'File count mismatch.');
    assert.equal(manifest.expanded_bytes, [...members.values()].reduce((sum, bytes) => sum + bytes.length, 0));
    assert.ok(Array.isArray(manifest.files), 'Missing per-file inventory.');
    assert.deepEqual(manifest.files.map((file: unknown) => object(file).path), [...members.keys()], 'Inventory mismatch.');
    for (const file of manifest.files) {
      const record = object(file);
      const bytes = members.get(String(record.path))!;
      assert.equal(record.bytes, bytes.length, 'Member size mismatch.');
      assert.equal(record.sha256, sha256(bytes), 'Member SHA-256 mismatch.');
      assert.ok(!/(^|\/)(\.env[^/]*|\.aws|\.venv|node_modules|__pycache__|credentials)(\/|$)|\.(pyc|pyd|dll|exe)$/i.test(String(record.path)), 'Prohibited artifact file.');
      if (String(record.path).endsWith('.so')) {
        assert.ok(bytes.length >= 20 && bytes.subarray(0, 6).equals(Buffer.from([127, 69, 76, 70, 2, 1])) && bytes.readUInt16LE(18) === 62, 'Invalid Linux x86_64 binary.');
      }
    }
    const current = sources(join(repositoryRoot, 'backend/src/hireflux_backend'));
    assert.deepEqual([...members.keys()].filter((name) => name.startsWith('hireflux_backend/')).sort(), [...current.keys()].sort(), 'Runtime source inventory changed; rebuild.');
    for (const [name, bytes] of current) assert.equal(sha256(members.get(name)!), sha256(bytes), `Stale runtime source: ${name}`);
    for (const name of ['hireflux_backend/lambda_handler.py', 'boto3/__init__.py', 'botocore/__init__.py', 'mangum/__init__.py', 'fastapi/__init__.py']) {
      assert.ok(members.has(name), `Missing required runtime member: ${name}`);
    }
    return Object.freeze({ path, sha256: hash });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : 'Invalid local artifact.';
    throw new Error(`Lambda artifact verification failed: ${reason} Build explicitly with Python 3.14: backend/scripts/build_lambda_artifact.py --verify-reproducible.`, { cause: undefined });
  }
}
