// embed-boot.js — embed SDK for Wavedrom Editor
//
// Hosts (VS Code webview, Confluence Forge / Data Center) load the standard
// editor scripts followed by this file. It exposes a single global:
//
//   WavedromEditor.mount(rootEl, {
//     initial: string | object,           // wavedrom JSON
//     readonly: boolean,                  // (not yet enforced)
//     onChange: (json, jsonText) => void, // every edit
//     onCommand: (cmd) => void,           // {type:'save', payload:{json}}
//     onReady: () => void,                // mount completed
//   }) -> { setJson, destroy }
//
// And a thin postMessage adapter (postMessageHost) that wires the SDK to a
// parent frame (VS Code's webview API uses the same shape).
//
// Inbound messages:
//   {type: 'init',    payload: { initial, readonly }}
//   {type: 'setJson', payload: json}
//
// Outbound messages:
//   {type: 'ready'}
//   {type: 'change',  payload: { json, jsonText }}
//   {type: 'command', payload: { type, payload }}

(function () {
  function getApp() {
    const App = (window.__WaveEditor || {}).App;
    if (!App) {
      throw new Error('[wavedrom-embed] App not found — make sure editor.jsx has loaded before calling mount()');
    }
    return App;
  }

  function mount(rootEl, opts) {
    const App = getApp();
    opts = opts || {};
    const bridge = {};               // App writes setJson into this
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      React.createElement(App, {
        initial: opts.initial,
        readonly: !!opts.readonly,
        embedded: true,
        bridge: bridge,
        onChange: opts.onChange,
        onCommand: opts.onCommand,
      })
    );
    // onReady fires after React commits — defer to next tick so the bridge is wired
    if (opts.onReady) setTimeout(() => { try { opts.onReady(); } catch (e) {} }, 0);
    return {
      setJson(j) {
        if (bridge.setJson) bridge.setJson(j);
      },
      destroy() {
        root.unmount();
      },
    };
  }

  // ── postMessage host adapter ─────────────────────────────────
  // Wraps mount() with a window message bridge to a parent frame. Works for
  // any host that lives in a parent window (iframe scenarios) AND for the
  // VS Code webview's `acquireVsCodeApi()` since both honour postMessage.
  function postMessageHost(rootEl, opts) {
    opts = opts || {};
    const target = opts.targetWindow || window.parent;
    const targetOrigin = opts.targetOrigin || '*';
    const post = (msg) => target.postMessage(msg, targetOrigin);

    let api = null;

    const handler = (ev) => {
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'init') {
        // (re-)mount with the provided initial JSON
        if (api) api.destroy();
        api = mount(rootEl, {
          initial: m.payload && m.payload.initial,
          readonly: !!(m.payload && m.payload.readonly),
          onReady: () => post({ type: 'ready' }),
          onChange: (json, jsonText) => post({ type: 'change', payload: { json, jsonText } }),
          onCommand: (cmd) => post({ type: 'command', payload: cmd }),
        });
      } else if (m.type === 'setJson') {
        if (api) api.setJson(m.payload);
      } else if (m.type === 'destroy') {
        if (api) { api.destroy(); api = null; }
      }
    };
    window.addEventListener('message', handler);

    // Announce that we're listening — host should respond with 'init'
    post({ type: 'hello' });

    return {
      destroy() {
        window.removeEventListener('message', handler);
        if (api) api.destroy();
      },
    };
  }

  window.WavedromEditor = { mount, postMessageHost, version: '0.4.1' };
})();
