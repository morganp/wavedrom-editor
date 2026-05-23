import { view, invoke, Modal } from '@forge/bridge';

const previewEl = document.getElementById('preview');
const editBtn   = document.getElementById('edit');

let macroId = null;

async function resolveId() {
  if (macroId) return macroId;
  const ctx = await view.getContext();
  macroId = ctx.extension?.localId || ctx.localId || null;
  return macroId;
}

async function load() {
  const id = await resolveId();
  if (!id) return JSON.stringify({ error: 'no macro localId in context' });
  try {
    const { body } = await invoke('wavedrom-load', { id });
    return body;
  } catch (e) {
    return JSON.stringify({ error: 'load failed: ' + (e?.message || e) });
  }
}

function render(jsonText) {
  try {
    previewEl.innerHTML = window.WavedromView.renderDiagram(jsonText);
  } catch (e) {
    previewEl.innerHTML = `<div class="err">Render error: ${e.message}</div>`;
  }
  try { view.resize(); } catch { /* older bridges no-op */ }
}

editBtn.addEventListener('click', async (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  try {
    const id = await resolveId();
    if (!id) { alert('Cannot edit: no macro id available.'); return; }
    const initial = await load();
    const modal = new Modal({
      resource: 'editor-modal',
      size: 'max',
      context: { id, initial },
      onClose: async () => { render(await load()); },
    });
    await modal.open();
  } catch (e) {
    alert('Edit failed: ' + (e?.message || e));
  }
});

// Initial render
load().then(render);
