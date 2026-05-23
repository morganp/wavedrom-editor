import { view, invoke, Modal } from '@forge/bridge';

const previewEl = document.getElementById('preview');
const editBtn   = document.getElementById('edit');
const engineSel = document.getElementById('engine');

let macroId    = null;
let lastBody   = null;
let lastEngine = 'official';

async function resolveId() {
  if (macroId) return macroId;
  const ctx = await view.getContext();
  macroId = ctx.extension?.localId || ctx.localId || null;
  return macroId;
}

async function load() {
  const id = await resolveId();
  if (!id) return { body: JSON.stringify({ error: 'no macro localId in context' }), engine: 'native' };
  try {
    const { body, engine } = await invoke('wavedrom-load', { id });
    return { body, engine: engine || 'official' };
  } catch (e) {
    return { body: JSON.stringify({ error: 'load failed: ' + (e?.message || e) }), engine: 'native' };
  }
}

function pickRenderer(engine) {
  if (engine === 'native') return window.WavedromViewNative;
  return window.WavedromViewOfficial || window.WavedromViewNative;
}

function render(body, engine) {
  lastBody = body;
  lastEngine = engine;
  engineSel.value = engine;
  const renderer = pickRenderer(engine);
  try {
    previewEl.innerHTML = renderer.renderDiagram(body);
  } catch (e) {
    previewEl.innerHTML = `<div class="err">Render error: ${e.message}</div>`;
  }
  try { view.resize(); } catch { /* older bridges no-op */ }
}

async function refresh() {
  const { body, engine } = await load();
  render(body, engine);
}

engineSel.addEventListener('change', async (ev) => {
  const engine = ev.target.value;
  const id = await resolveId();
  if (id) {
    try { await invoke('wavedrom-save', { id, body: lastBody, engine }); }
    catch (e) { alert('Could not persist engine: ' + (e?.message || e)); }
  }
  render(lastBody, engine);
});

editBtn.addEventListener('click', async (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  try {
    const id = await resolveId();
    if (!id) { alert('Cannot edit: no macro id available.'); return; }
    const modal = new Modal({
      resource: 'editor-modal',
      size: 'max',
      context: { id, initial: lastBody, engine: lastEngine },
      onClose: refresh,
    });
    await modal.open();
  } catch (e) {
    alert('Edit failed: ' + (e?.message || e));
  }
});

refresh();
