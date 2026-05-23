import { view, invoke } from '@forge/bridge';

const ctx = await view.getContext();
document.documentElement.dataset.theme = ctx.themeState?.colorMode || 'light';

function pickModalCtx(ctx) {
  return (
    ctx?.extension?.modal?.context ||
    ctx?.extension?.modal ||
    ctx?.context ||
    null
  );
}

const modalCtx = pickModalCtx(ctx) || {};
const id      = modalCtx.id;
const initial = modalCtx.initial || '{}';
const engine  = modalCtx.engine || 'official';
let latest = initial;

async function persistAndClose() {
  if (!id) {
    alert('Cannot save: missing macro id in modal context.');
    return;
  }
  try {
    await invoke('wavedrom-save', { id, body: latest, engine });
  } catch (e) {
    alert('Save failed: ' + (e?.message || e));
    return;
  }
  view.close();
}

window.WavedromEditor.mount(document.getElementById('root'), {
  initial: latest,
  embedded: true,
  onChange: (_json, jsonText) => { latest = jsonText; },
  onCommand: (cmd) => { if (cmd?.type === 'save') persistAndClose(); },
});

document.getElementById('save').addEventListener('click', persistAndClose);
document.getElementById('cancel').addEventListener('click', () => view.close());
