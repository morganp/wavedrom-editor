// Forge function handlers for the WaveDrom Confluence Cloud macro.
//
// Persistence: each macro instance owns a UUID stored in its config.
// The actual WaveJSON text is kept in Forge `storage.set(`diagram:<uuid>`)`.
// This keeps the macro config tiny and side-steps the 32-bytes-of-config
// soft limit while staying inside the `storage:app` scope.

import { storage } from '@forge/api';
import { randomUUID } from 'crypto';

const DEFAULT_SPEC = {
  signal: [
    { name: 'clk',  wave: 'p......' },
    { name: 'data', wave: 'x.345x.', data: ['A', 'B', 'C'] },
    { name: 'vld',  wave: '0.1...0' },
  ],
  head: { text: 'WaveDrom diagram' },
};

const keyFor = (uuid) => `diagram:${uuid}`;

// Called once when the user inserts the macro. Mints a UUID, seeds default
// JSON in storage, and returns the UUID as the macro's persistent config.
export async function defaultConfig() {
  const uuid = randomUUID();
  await storage.set(keyFor(uuid), JSON.stringify(DEFAULT_SPEC, null, 2));
  return { uuid };
}

// Read the JSON for an existing macro instance. Returns the default spec
// (and re-seeds storage) if the key is missing — handles page copy/duplicate.
export async function loadDiagram(req) {
  const { uuid } = req.payload || {};
  if (!uuid) throw new Error('loadDiagram: missing uuid');
  let body = await storage.get(keyFor(uuid));
  if (!body) {
    body = JSON.stringify(DEFAULT_SPEC, null, 2);
    await storage.set(keyFor(uuid), body);
  }
  return { body };
}

export async function saveDiagram(req) {
  const { uuid, body } = req.payload || {};
  if (!uuid) throw new Error('saveDiagram: missing uuid');
  if (typeof body !== 'string') throw new Error('saveDiagram: body must be a string');
  await storage.set(keyFor(uuid), body);
  return { ok: true };
}
