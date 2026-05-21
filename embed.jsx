// embed.jsx — library entry point for the Wavedrom Editor embed bundle.
// Produces dist/embed.js (IIFE, sets window.WavedromEditor) + dist/embed.css.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './editor.jsx';
import './styles.css';

const version = '0.4.1';

function mount(rootEl, opts) {
  opts = opts || {};
  const bridge = {};
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    React.createElement(App, {
      initial: opts.initial,
      readonly: !!opts.readonly,
      embedded: true,
      bridge,
      onChange: opts.onChange,
      onCommand: opts.onCommand,
    })
  );
  if (opts.onReady) setTimeout(() => { try { opts.onReady(); } catch (e) {} }, 0);
  return {
    setJson(j) { if (bridge.setJson) bridge.setJson(j); },
    destroy() { root.unmount(); },
  };
}

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
  post({ type: 'hello' });

  return {
    destroy() {
      window.removeEventListener('message', handler);
      if (api) api.destroy();
    },
  };
}

// IIFE build: Vite sets window.WavedromEditor = exports automatically via `name`.
// ESM build: consumers import { mount, postMessageHost } from 'wavedrom-editor/embed'.
export { mount, postMessageHost, version };
