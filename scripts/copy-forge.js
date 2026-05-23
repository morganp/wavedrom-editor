// Copy built embed/view IIFE bundles into the Confluence Forge built/ tree.
// Runs after `vite build` for each Custom UI entry. The built/ tree is what
// the Forge manifest points its resources at.

import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root  = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist  = resolve(root, 'dist');
const forge = resolve(root, 'packages', 'confluence-forge');

const editorBuilt = resolve(forge, 'built', 'editor');
const macroBuilt  = resolve(forge, 'built', 'macro');

if (!existsSync(editorBuilt) || !existsSync(macroBuilt)) {
  console.error('ERROR: built/{macro,editor} missing. Run `npm run build:ui` in packages/confluence-forge first.');
  process.exit(1);
}

const editorBundle = resolve(editorBuilt, 'bundle');
const macroBundle  = resolve(macroBuilt,  'bundle');
mkdirSync(editorBundle, { recursive: true });
mkdirSync(macroBundle,  { recursive: true });

cpSync(resolve(dist, 'embed.iife.js'), resolve(editorBundle, 'embed.js'));
cpSync(resolve(dist, 'embed.css'),     resolve(editorBundle, 'embed.css'));
cpSync(resolve(dist, 'view.iife.js'),  resolve(macroBundle,  'view.js'));

console.log('Forge bundles copied into built/.');
