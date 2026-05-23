// Forge resolver for the WaveDrom Confluence Cloud macro.
//
// Custom UI invokes from the iframe (via `invoke(key, payload)`) are
// routed through this single resolver. Each `resolver.define()` registers
// a key that matches the string passed in the iframe.
//
// Persistence: each macro instance has a stable Forge-assigned localId
// passed in from the iframe as `payload.id`. The WaveJSON text is stored
// at `storage.set(`diagram:<localId>`)`.

import ResolverImport from '@forge/resolver';
import { storage } from '@forge/api';

// Webpack CJS-interop fallback: some bundles expose the class on `.default`.
const Resolver = ResolverImport?.default || ResolverImport;

const DEFAULT_SPEC = {
  signal: [
    { name: 'clk',  wave: 'p......' },
    { name: 'data', wave: 'x.345x.', data: ['A', 'B', 'C'] },
    { name: 'vld',  wave: '0.1...0' },
  ],
  head: { text: 'WaveDrom diagram' },
};

const keyFor = (id) => `diagram:${id}`;

const resolver = new Resolver();

resolver.define('wavedrom-load', async ({ payload }) => {
  const { id } = payload || {};
  if (!id) throw new Error('wavedrom-load: missing id');
  let body = await storage.get(keyFor(id));
  if (!body) {
    body = JSON.stringify(DEFAULT_SPEC, null, 2);
    await storage.set(keyFor(id), body);
  }
  return { body };
});

resolver.define('wavedrom-save', async ({ payload }) => {
  const { id, body } = payload || {};
  if (!id) throw new Error('wavedrom-save: missing id');
  if (typeof body !== 'string') throw new Error('wavedrom-save: body must be a string');
  await storage.set(keyFor(id), body);
  return { ok: true };
});

export const handler = resolver.getDefinitions();
