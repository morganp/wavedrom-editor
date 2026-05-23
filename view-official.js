// view-official.js — IIFE bundle entry for the upstream `wavedrom` package.
// Exposes the same global API as view.js (`window.WavedromView.renderDiagram`)
// so host shells (e.g. the Confluence Forge macro view) can drop it in
// for exact parity with wavedrom.com.
//
// The eval() inside wavedrom/lib/eva.js is dead code on this path —
// renderAny() takes a pre-parsed object, so strict-CSP hosts are fine.

import wd from 'wavedrom';

function errorSvg(msg) {
  const safe = String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="36">` +
         `<text x="8" y="22" fill="#b13a3a" font-size="12" font-family="ui-monospace,monospace">` +
         `${safe}</text></svg>`;
}

export function renderDiagram(input) {
  let source;
  try {
    source = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (e) {
    return errorSvg('Invalid JSON: ' + e.message);
  }
  if (!source || !Array.isArray(source.signal)) {
    return errorSvg('No signals');
  }
  try {
    const ml = wd.renderAny(0, source, wd.waveSkin);
    return wd.onml.stringify(ml);
  } catch (e) {
    return errorSvg('Render error: ' + (e?.message || e));
  }
}

if (typeof window !== 'undefined') {
  window.WavedromView = { renderDiagram };
}
