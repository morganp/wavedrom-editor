import { view, invoke } from '@forge/bridge';

const ctx = await view.getContext();
document.documentElement.dataset.theme = ctx.themeState?.colorMode || 'light';

// The Modal({context}) we open from the macro view should reach us via one of:
//   ctx.extension.modal.context   (older docs)
//   ctx.extension.modal           (some versions)
//   ctx.context                   (Custom UI v2)
// Try each and surface what we actually got, so misses are diagnosable.
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
let latest = initial;

async function persistAndClose() {
  if (!id) {
    alert('Cannot save: missing macro id in modal context.');
    return;
  }
  try {
    await invoke('wavedrom-save', { id, body: latest });
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
