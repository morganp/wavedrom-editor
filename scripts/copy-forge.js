// Copy built assets into Confluence Forge resource directories.
import { cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist   = resolve(root, 'dist');
const forge  = resolve(root, 'packages', 'confluence-forge');

const editorBundle = resolve(forge, 'resources', 'editor', 'bundle');
const macroBundle  = resolve(forge, 'resources', 'macro',  'bundle');

mkdirSync(editorBundle, { recursive: true });
mkdirSync(macroBundle,  { recursive: true });

cpSync(resolve(dist, 'embed.iife.js'), resolve(editorBundle, 'embed.js'));
cpSync(resolve(dist, 'embed.css'),     resolve(editorBundle, 'embed.css'));
cpSync(resolve(dist, 'view.iife.js'),  resolve(macroBundle,  'view.js'));

console.log('Forge bundles copied.');
