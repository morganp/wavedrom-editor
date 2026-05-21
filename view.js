// view.js — lightweight SVG renderer for Confluence macro view.
// No React. Only imports wave-render.js (~10 KB).
import { parseWave, renderWave } from './wave-render.js';

const CW      = 40;
const ROW_H   = 40;
const PAD     = 8;
const LABEL_W = 100;

function flatSignals(signals, depth = 0) {
  const rows = [];
  for (const s of (signals || [])) {
    if (Array.isArray(s)) {
      rows.push({ type: 'group', name: s[0], depth });
      rows.push(...flatSignals(s.slice(1), depth + 1));
    } else if (s && typeof s === 'object' && 'wave' in s) {
      rows.push({ type: 'signal', depth, ...s });
    }
  }
  return rows;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// camelCase attr → kebab-case XML attr
function attrName(k) {
  return k === 'strokeWidth' ? 'stroke-width'
    : k === 'textAnchor'    ? 'text-anchor'
    : k === 'fontFamily'    ? 'font-family'
    : k === 'fontSize'      ? 'font-size'
    : k === 'pointerEvents' ? 'pointer-events'
    : k;
}

// Resolve CSS var references to plain hex for standalone SVG
const COLOR_MAP = {
  'var(--bus-eq)': '#e8d5b7',
  'var(--bus-2)':  '#c8dff0',
  'var(--bus-3)':  '#c8f0d8',
  'var(--bus-4)':  '#f0e8c8',
  'var(--bus-5)':  '#f0c8c8',
};
function resolveColor(v) { return COLOR_MAP[v] || v; }

function elToSvg(el) {
  const [tag, attrs, content] = el;
  const skip = new Set(['key', 'style']);
  const parts = Object.entries(attrs)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => {
      const val = (k === 'fill' || k === 'stroke') ? resolveColor(v) : v;
      return `${attrName(k)}="${esc(val)}"`;
    })
    .join(' ');
  if (tag === 'text') return `<text ${parts}>${esc(content)}</text>`;
  return `<${tag} ${parts}/>`;
}

export function renderDiagram(jsonText) {
  let spec;
  try {
    spec = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  } catch (e) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="36">` +
      `<text x="8" y="22" fill="#b13a3a" font-size="12" font-family="ui-monospace,monospace">` +
      `Invalid JSON: ${esc(e.message)}</text></svg>`;
  }

  const rows = flatSignals(spec.signal);
  const signals = rows.filter(r => r.type === 'signal');

  if (signals.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40">` +
      `<text x="8" y="24" fill="#888" font-size="12" font-family="system-ui,sans-serif">No signals</text></svg>`;
  }

  const totalCycles = signals.reduce((m, s) => Math.max(m, (s.wave || '').length), 0);
  const contentW    = totalCycles * CW;
  const totalW      = LABEL_W + contentW + PAD * 2;
  const totalH      = rows.length * ROW_H + PAD * 2;

  const parts = [];
  let rowIdx = 0;

  for (const row of rows) {
    const y    = PAD + rowIdx * ROW_H;
    const midY = y + ROW_H / 2 + 4;

    if (row.type === 'group') {
      parts.push(
        `<text x="${LABEL_W - 8}" y="${midY}" text-anchor="end" ` +
        `font-size="10" fill="#5a6068" font-family="system-ui,sans-serif" font-style="italic">${esc(row.name || '')}</text>`
      );
    } else {
      // label
      parts.push(
        `<text x="${LABEL_W - 8}" y="${midY}" text-anchor="end" ` +
        `font-size="11" fill="#1f2328" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">${esc(row.name || '')}</text>`
      );
      // wave
      const segs = parseWave(row.wave || '');
      const { els } = renderWave(segs, {
        cw:         CW,
        period:     row.period || 1,
        h:          ROW_H,
        pad:        Math.max(6, ROW_H * 0.18),
        phase:      row.phase  || 0,
        dataLabels: row.data   || [],
      });
      parts.push(
        `<g transform="translate(${LABEL_W + PAD},${y})" stroke="#1f2328" fill="none" stroke-width="1.5">`
      );
      for (const el of els) parts.push('  ' + elToSvg(el));
      parts.push(`</g>`);
    }
    rowIdx++;
  }

  // grid lines between rows
  for (let i = 1; i < rows.length; i++) {
    const ly = PAD + i * ROW_H;
    parts.push(`<line x1="${LABEL_W}" y1="${ly}" x2="${totalW}" y2="${ly}" stroke="#e7e6e1" stroke-width="0.5"/>`);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" style="max-width:100%;display:block">`,
    ...parts,
    `</svg>`,
  ].join('\n');
}

if (typeof window !== 'undefined') {
  window.WavedromView = { renderDiagram };
}
