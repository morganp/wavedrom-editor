// Copy built assets into the Confluence DC plugin resource directory.
import { cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root   = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist   = resolve(root, 'dist');
const bundle = resolve(root, 'packages', 'confluence-dc', 'src', 'main', 'resources', 'bundle');

mkdirSync(bundle, { recursive: true });

cpSync(resolve(dist, 'embed.iife.js'), resolve(bundle, 'embed.js'));
cpSync(resolve(dist, 'embed.css'),     resolve(bundle, 'embed.css'));
cpSync(resolve(dist, 'view.iife.js'),  resolve(bundle, 'view.js'));

console.log('DC plugin bundles copied.');
