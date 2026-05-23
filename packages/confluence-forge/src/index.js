// Forge resolver for the WaveDrom Confluence Cloud macro.
//
// Custom UI invokes from the iframe (via `invoke(key, payload)`) are
// routed through this single resolver. Each `resolver.define()` registers
// a key that matches the string passed in the iframe.
//
// Persistence: each macro instance has a stable Forge-assigned localId
// passed in from the iframe as `payload.id`. We store WaveJSON text at
// `diagram:<localId>` and the user's renderer preference at
// `engine:<localId>` (one of 'native' | 'official', default 'official').

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
const DEFAULT_ENGINE = 'official';

const bodyKey   = (id) => `diagram:${id}`;
const engineKey = (id) => `engine:${id}`;

const resolver = new Resolver();

resolver.define('wavedrom-load', async ({ payload }) => {
  const { id } = payload || {};
  if (!id) throw new Error('wavedrom-load: missing id');
  let body = await storage.get(bodyKey(id));
  if (!body) {
    body = JSON.stringify(DEFAULT_SPEC, null, 2);
    await storage.set(bodyKey(id), body);
  }
  const engine = (await storage.get(engineKey(id))) || DEFAULT_ENGINE;
  return { body, engine };
});

resolver.define('wavedrom-save', async ({ payload }) => {
  const { id, body, engine } = payload || {};
  if (!id) throw new Error('wavedrom-save: missing id');
  if (typeof body !== 'string') throw new Error('wavedrom-save: body must be a string');
  await storage.set(bodyKey(id), body);
  if (engine === 'native' || engine === 'official') {
    await storage.set(engineKey(id), engine);
  }
  return { ok: true };
});

export const handler = resolver.getDefinitions();
