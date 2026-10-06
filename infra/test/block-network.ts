import { appendFileSync } from 'node:fs';
import { Socket } from 'node:net';
import dns = require('node:dns');
import tls = require('node:tls');

function rejectNetwork(): never {
  const auditPath = process.env.HIREFLUX_NETWORK_AUDIT_PATH;
  if (auditPath !== undefined) appendFileSync(auditPath, `${new Error('attempted network access').stack}\n`);
  throw new Error('Network access is forbidden in the offline synthesis test.');
}

Socket.prototype.connect = rejectNetwork;
dns.lookup = Object.assign(rejectNetwork, { __promisify__: rejectNetwork });
tls.connect = rejectNetwork;
globalThis.fetch = rejectNetwork;
