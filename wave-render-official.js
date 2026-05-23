// wave-render-official.js — thin wrapper around the official `wavedrom`
// npm package that exposes the same `renderDiagram(jsonText) → svgString`
// signature as our in-house `view.js`. Lazy-loads the official module so
// callers pay the ~50 KB gzip cost only when the toggle is flipped.

let _wavedromPromise = null;

function loadWavedrom() {
  if (!_wavedromPromise) {
    _wavedromPromise = import('wavedrom').then((m) => m.default || m);
  }
  return _wavedromPromise;
}

// Render WaveJSON (object or text) to an SVG string using the official
// renderer. Returns a Promise<string> so callers can await + render.
export async function renderDiagram(input) {
  const wd = await loadWavedrom();
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

function errorSvg(msg) {
  const safe = String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="36">` +
         `<text x="8" y="22" fill="#b13a3a" font-size="12" font-family="ui-monospace,monospace">` +
         `${safe}</text></svg>`;
}

// Convenience: expose on `window.WavedromViewOfficial` so non-module
// host pages (e.g. Confluence macro IIFE consumers) can call it the
// same way they call our native `window.WavedromView.renderDiagram`.
if (typeof window !== 'undefined') {
  window.WavedromViewOfficial = { renderDiagram };
}
