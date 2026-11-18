import { networkInterfaces } from 'node:os';
/** This laptop's address on the local network (what the iPads connect to). */
export function lanAddress() {
  for (const list of Object.values(networkInterfaces())) for (const a of list || [])
    if (a.family === 'IPv4' && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) return a.address;
  return 'localhost';
}
