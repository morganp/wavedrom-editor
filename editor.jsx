// editor.jsx — main React app for the Wavedrom Editor
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const { parseWave, renderWave, moveTransition, nextValue, TOGGLE_CYCLE } = window.WaveRender;

// ── small icon set (inline SVG) ────────────────────────────────────
const Icon = ({ d, size = 14 }) => (
  <svg className="ico" viewBox="0 0 24 24" width={size} height={size}
       fill="none" stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  add:    <Icon d={<><path d="M12 5v14M5 12h14"/></>} />,
  trash:  <Icon d={<><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>} />,
  group:  <Icon d={<><path d="M3 6h7v12H3zM14 6h7v5h-7zM14 13h7v5h-7z"/></>} />,
  undo:   <Icon d={<><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></>} />,
  redo:   <Icon d={<><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></>} />,
  png:    <Icon d={<><path d="M4 16l4-4 4 4 8-8"/><rect x="3" y="3" width="18" height="18" rx="2"/></>} />,
  svg:    <Icon d={<><path d="M4 4h16v16H4z"/><path d="M8 12h2l1 3 1-6 1 3h3"/></>} />,
  samples:<Icon d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />,
  cycleAdd:<Icon d={<><path d="M3 12h12M9 6l6 6-6 6"/><path d="M19 5v14"/></>} />,
  cycleDel:<Icon d={<><path d="M21 12H9M15 6l-6 6 6 6"/><path d="M5 5v14"/></>} />,
  edge:   <Icon d={<><path d="M4 17c4-10 12-10 16 0"/><path d="M16 17l4 0M20 13l0 4"/></>} />,
};

// ── normalize spec for editor use (give every signal an id) ────────
let __id = 0;
const newId = () => 'id_' + (++__id);

function ensureIds(spec) {
  const visit = (node) => {
    if (Array.isArray(node)) {
      // group: [name, ...children]
      for (let i = 1; i < node.length; i++) node[i] = visit(node[i]);
      return node;
    }
    if (node && typeof node === 'object' && 'wave' in node) {
      if (!node.__id) node.__id = newId();
      return node;
    }
    return node;
  };
  const next = JSON.parse(JSON.stringify(spec || {}));
  if (Array.isArray(next.signal)) next.signal = next.signal.map(visit);
  return next;
}

function stripIds(spec) {
  const visit = (node) => {
    if (Array.isArray(node)) return node.map(visit);
    if (node && typeof node === 'object' && 'wave' in node) {
      const { __id, ...rest } = node;
      return rest;
    }
    return node;
  };
  const next = JSON.parse(JSON.stringify(spec || {}));
  if (Array.isArray(next.signal)) next.signal = next.signal.map(visit);
  return next;
}

// flatten signal tree to rows (for rendering); preserve depth and references
function flattenSignals(spec) {
  const out = [];
  const walk = (node, depth) => {
    if (Array.isArray(node)) {
      out.push({ kind: 'group', name: node[0], depth, ref: node });
      for (let i = 1; i < node.length; i++) walk(node[i], depth + 1);
      return;
    }
    if (node && typeof node === 'object' && 'wave' in node) {
      out.push({ kind: 'signal', sig: node, depth });
    } else if (node && typeof node === 'object') {
      // spacer / object without wave: render as label-only row
      out.push({ kind: 'spacer', sig: node, depth });
    } else if (node === '' || node == null) {
      out.push({ kind: 'empty', depth });
    }
  };
  if (Array.isArray(spec.signal)) for (const n of spec.signal) walk(n, 0);
  return out;
}

// total cycles in spec — max wave string length scaled by period
function totalCycles(spec) {
  let max = 8;
  const visit = (node) => {
    if (Array.isArray(node)) { for (let i = 1; i < node.length; i++) visit(node[i]); return; }
    if (node && typeof node === 'object' && 'wave' in node) {
      const len = (node.wave || '').length * (node.period || 1) + (node.phase || 0);
      if (len > max) max = len;
    }
  };
  if (Array.isArray(spec.signal)) for (const n of spec.signal) visit(n);
  return Math.ceil(max);
}

// ── App ────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [spec, setSpec] = useState(() => ensureIds(window.WAVEDROM_SAMPLES[3].spec));
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [showSamples, setShowSamples] = useState(false);
  const [tip, setTip] = useState(null);
  const [docPanel, setDocPanel] = useState(false);
  const [cycleMenu, setCycleMenu] = useState(null); // {x, y, sigId, cycleIdx, current, nodeLetter, busLabel, busDataIdx}
  const [edgeDraft, setEdgeDraft] = useState(null); // {sigId, cycleIdx, letter}
  const [drawerH, setDrawerH] = useState(() => {
    const saved = parseInt(localStorage.getItem('wde.drawerH') || '', 10);
    return Number.isFinite(saved) && saved > 80 ? saved : 260;
  });
  useEffect(() => { localStorage.setItem('wde.drawerH', String(drawerH)); }, [drawerH]);

  // History
  const history = useRef([]);
  const future = useRef([]);
  const skipPush = useRef(false);
  useEffect(() => {
    if (skipPush.current) { skipPush.current = false; return; }
    history.current.push(JSON.stringify(spec));
    if (history.current.length > 80) history.current.shift();
    future.current = [];
  }, [spec]);
  const undo = () => {
    if (history.current.length < 2) return;
    const cur = history.current.pop();
    future.current.push(cur);
    const prev = history.current[history.current.length - 1];
    skipPush.current = true;
    setSpec(JSON.parse(prev));
  };
  const redo = () => {
    if (!future.current.length) return;
    const nxt = future.current.pop();
    history.current.push(nxt);
    skipPush.current = true;
    setSpec(JSON.parse(nxt));
  };

  // JSON sync — when spec changes, regenerate JSON text (without ids)
  useEffect(() => {
    setJsonText(JSON.stringify(stripIds(spec), null, 2));
    setJsonError(null);
  }, [spec]);

  // mutate helper that preserves identity
  const update = useCallback((mutator) => {
    setSpec((cur) => {
      const next = JSON.parse(JSON.stringify(cur));
      mutator(next);
      return next;
    });
  }, []);

  // find signal by id
  const findById = (root, id) => {
    let result = null;
    const visit = (node, parent, key) => {
      if (Array.isArray(node)) { for (let i = 1; i < node.length; i++) visit(node[i], node, i); return; }
      if (node && typeof node === 'object' && node.__id === id) { result = { sig: node, parent, key }; }
    };
    if (Array.isArray(root.signal)) root.signal.forEach((n, i) => visit(n, root.signal, i));
    return result;
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (meta && (e.key === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
      else if (meta && e.key === 's') { e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { setTweak('cw', Math.min(120, t.cw + 4)); }
      else if (e.key === '-' || e.key === '_') { setTweak('cw', Math.max(16, t.cw - 4)); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) { e.preventDefault(); deleteSignal(selectedId); }
      } else if (e.key === 'Escape' && edgeDraft) {
        e.preventDefault(); setEdgeDraft(null);
      } else if (e.key.toLowerCase() === 'a' && !meta) {
        addSignal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t.cw, selectedId, edgeDraft]);

  // ── actions ────────────────────────────────────────────────────
  const cycles = useMemo(() => Math.max(8, totalCycles(spec)), [spec]);

  const addSignal = () => {
    update((s) => {
      if (!Array.isArray(s.signal)) s.signal = [];
      s.signal.push({ name: 'sig' + s.signal.length, wave: '0'.padEnd(cycles, '.'), __id: newId() });
    });
  };
  const addGroup = () => {
    update((s) => {
      if (!Array.isArray(s.signal)) s.signal = [];
      s.signal.push(['group', { name: 'sig', wave: '0'.padEnd(cycles, '.'), __id: newId() }]);
    });
  };
  const deleteSignal = (id) => {
    update((s) => {
      const visit = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const n = arr[i];
          if (Array.isArray(n)) {
            visit(n); // will visit name slot too but it's a string
            // remove index 0 isn't an object; safe
          } else if (n && typeof n === 'object' && n.__id === id) {
            arr.splice(i, 1);
          }
        }
      };
      // Need to skip index 0 of group arrays (the name string).
      const realVisit = (arr, isGroup = false) => {
        const start = isGroup ? 1 : 0;
        for (let i = arr.length - 1; i >= start; i--) {
          const n = arr[i];
          if (Array.isArray(n)) realVisit(n, true);
          else if (n && typeof n === 'object' && n.__id === id) arr.splice(i, 1);
        }
      };
      if (Array.isArray(s.signal)) realVisit(s.signal, false);
    });
    setSelectedId(null);
  };
  const addCycle = () => {
    update((s) => {
      const visit = (n) => {
        if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) visit(n[i]); return; }
        if (n && typeof n === 'object' && 'wave' in n) n.wave = (n.wave || '') + '.';
      };
      if (Array.isArray(s.signal)) s.signal.forEach(visit);
    });
  };
  const removeCycle = () => {
    update((s) => {
      const visit = (n) => {
        if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) visit(n[i]); return; }
        if (n && typeof n === 'object' && 'wave' in n && (n.wave || '').length > 1) n.wave = n.wave.slice(0, -1);
      };
      if (Array.isArray(s.signal)) s.signal.forEach(visit);
    });
  };

  const reorderSignal = (sourceId, targetId, position) => {
    // position: 'above' | 'below'
    update((s) => {
      // remove source from its parent
      let removed = null;
      const remove = (arr, isGroup) => {
        const start = isGroup ? 1 : 0;
        for (let i = start; i < arr.length; i++) {
          const n = arr[i];
          if (Array.isArray(n)) { if (remove(n, true)) return true; }
          else if (n && typeof n === 'object' && n.__id === sourceId) {
            removed = arr.splice(i, 1)[0];
            return true;
          }
        }
        return false;
      };
      remove(s.signal, false);
      if (!removed) return;
      // insert relative to target
      const insert = (arr, isGroup) => {
        const start = isGroup ? 1 : 0;
        for (let i = start; i < arr.length; i++) {
          const n = arr[i];
          if (Array.isArray(n)) { if (insert(n, true)) return true; }
          else if (n && typeof n === 'object' && n.__id === targetId) {
            arr.splice(position === 'below' ? i + 1 : i, 0, removed);
            return true;
          }
        }
        return false;
      };
      insert(s.signal, false);
    });
  };

  // Apply a wave-string change for a given signal id.
  const setWave = (id, wave) => {
    update((s) => {
      const f = findById(s, id); if (f) f.sig.wave = wave;
    });
  };
  const setCycleChar = (id, idx, ch) => {
    update((s) => {
      const f = findById(s, id); if (!f) return;
      const w = f.sig.wave || '';
      if (idx < 0 || idx >= w.length) return;
      const arr = w.split(''); arr[idx] = ch; f.sig.wave = arr.join('');
    });
  };

  // Node tag helpers
  const BUS_CH = new Set(['=', '2', '3', '4', '5']);
  const resolveWaveCh = (wave, idx) => {
    let i = idx;
    while (i > 0 && (wave[i] === '.' || wave[i] === '|')) i--;
    return wave[i] || '0';
  };
  const busDataIdxFor = (wave, cycleIdx) => {
    let idx = -1;
    for (let i = 0; i <= cycleIdx && i < wave.length; i++) {
      if (BUS_CH.has(wave[i])) idx++;
    }
    return idx;
  };
  const nodeLetterAt = (sig, cycleIdx) => {
    const node = sig.node || '';
    const c = node[cycleIdx];
    return c && /[A-Za-z]/.test(c) ? c : null;
  };
  const usedNodeLetters = (root) => {
    const used = new Set();
    const visit = (n) => {
      if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) visit(n[i]); return; }
      if (n && typeof n === 'object' && n.node) {
        for (const c of n.node) if (/[A-Za-z]/.test(c)) used.add(c);
      }
    };
    if (Array.isArray(root.signal)) root.signal.forEach(visit);
    return used;
  };
  const nextFreeLetter = (root) => {
    const used = usedNodeLetters(root);
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      if (!used.has(ch)) return ch;
    }
    for (let c = 65; c <= 90; c++) {
      const ch = String.fromCharCode(c);
      if (!used.has(ch)) return ch;
    }
    return 'a';
  };
  // Write a node letter at a cycle index (clears with letter=null/'')
  const writeNodeAt = (next, sigId, cycleIdx, letter) => {
    const f = findById(next, sigId); if (!f) return;
    const w = f.sig.wave || '';
    let node = f.sig.node || '';
    while (node.length < w.length) node += '.';
    const arr = node.split('');
    arr[cycleIdx] = (letter && /[A-Za-z]/.test(letter)) ? letter : '.';
    const result = arr.join('').replace(/\.+$/, '');
    if (result) f.sig.node = result;
    else delete f.sig.node;
  };
  const setNodeLetter = (sigId, cycleIdx, letter) => {
    update((s) => writeNodeAt(s, sigId, cycleIdx, letter));
  };
  // Bus label
  const setBusLabel = (sigId, cycleIdx, label) => {
    update((s) => {
      const f = findById(s, sigId); if (!f) return;
      const w = f.sig.wave || '';
      const dataIdx = busDataIdxFor(w, cycleIdx);
      if (dataIdx < 0) return;
      let data = Array.isArray(f.sig.data) ? f.sig.data.slice()
        : f.sig.data ? String(f.sig.data).split(' ') : [];
      while (data.length <= dataIdx) data.push('');
      data[dataIdx] = label;
      // trim trailing empties
      while (data.length && data[data.length - 1] === '') data.pop();
      if (data.length) f.sig.data = data;
      else delete f.sig.data;
    });
  };

  // Edge placement flow
  const startEdge = (sigId, cycleIdx) => {
    // Precompute the letter from the CURRENT spec — the React 18 updater is
    // batched, so we can't read out a captured value after `update()` returns.
    const f = findById(spec, sigId); if (!f) return;
    const letter = nodeLetterAt(f.sig, cycleIdx) || nextFreeLetter(spec);
    update((s) => writeNodeAt(s, sigId, cycleIdx, letter));
    setEdgeDraft({ sigId, cycleIdx, letter });
  };
  const finishEdge = (sigId, cycleIdx, op) => {
    if (!edgeDraft) return;
    const draft = edgeDraft;       // capture so the closure doesn't re-read
    setEdgeDraft(null);            // clear immediately to prevent re-entry
    update((s) => {
      const f = findById(s, sigId); if (!f) return;
      const existing = nodeLetterAt(f.sig, cycleIdx);
      let letter = existing;
      if (!letter) {
        const used = usedNodeLetters(s);
        used.add(draft.letter);
        for (let c = 97; c <= 122 && !letter; c++) {
          const ch = String.fromCharCode(c);
          if (!used.has(ch)) letter = ch;
        }
        if (!letter) letter = 'a';
      }
      writeNodeAt(s, sigId, cycleIdx, letter);
      if (!Array.isArray(s.edge)) s.edge = [];
      s.edge.push(`${draft.letter}${op || '->'}${letter}`);
    });
  };
  const cancelEdgeDraft = () => setEdgeDraft(null);

  // Drag an edge endpoint to a different cell.
  // edgeIdx: index in spec.edge
  // end: 'a' or 'b' (the 'from' or 'to' side)
  // toSigId/toCycleIdx: where the user dropped
  const moveEdgeEndpoint = (edgeIdx, end, toSigId, toCycleIdx) => {
    update((s) => {
      if (!Array.isArray(s.edge) || edgeIdx < 0 || edgeIdx >= s.edge.length) return;
      const m = String(s.edge[edgeIdx]).match(/^([A-Za-z])([\-~<|>]+)([A-Za-z])\s*(.*)$/);
      if (!m) return;
      const [, from, op, to, label] = m;
      const oldLetter = end === 'a' ? from : to;
      const f = findById(s, toSigId); if (!f) return;
      // Reuse existing letter at target cell if present; else allocate a fresh letter.
      const targetExisting = nodeLetterAt(f.sig, toCycleIdx);
      let newLetter;
      if (targetExisting) {
        newLetter = targetExisting;
      } else {
        newLetter = nextFreeLetter(s);
        writeNodeAt(s, toSigId, toCycleIdx, newLetter);
      }
      const newFrom = end === 'a' ? newLetter : from;
      const newTo   = end === 'b' ? newLetter : to;
      s.edge[edgeIdx] = `${newFrom}${op}${newTo}${label ? ' ' + label : ''}`;
      // If the original letter is no longer used by any edge, scrub it from node strings.
      if (newLetter !== oldLetter) {
        const stillRef = s.edge.some((e2, i2) => {
          if (i2 === edgeIdx) return false;
          const mm = String(e2).match(/^([A-Za-z])([\-~<|>]+)([A-Za-z])\s*(.*)$/);
          return mm && (mm[1] === oldLetter || mm[3] === oldLetter);
        });
        if (!stillRef) {
          const scrub = (n) => {
            if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) scrub(n[i]); return; }
            if (n && typeof n === 'object' && n.node && n.node.includes(oldLetter)) {
              const arr = n.node.split('');
              for (let i = 0; i < arr.length; i++) if (arr[i] === oldLetter) arr[i] = '.';
              const cleaned = arr.join('').replace(/\.+$/, '');
              if (cleaned) n.node = cleaned; else delete n.node;
            }
          };
          if (Array.isArray(s.signal)) s.signal.forEach(scrub);
        }
      }
    });
  };
  const patchSig = (id, patch) => {
    update((s) => {
      const f = findById(s, id); if (!f) return;
      Object.assign(f.sig, patch);
      // clean: remove default-valued props
      if (f.sig.phase === 0) delete f.sig.phase;
      if (f.sig.period === 1) delete f.sig.period;
    });
  };

  // ── JSON drawer apply ────────────────────────────────────────
  const applyJson = (txt) => {
    try {
      const parsed = JSON.parse(txt);
      setSpec(ensureIds(parsed));
      setJsonError(null);
    } catch (e) { setJsonError(e.message); }
  };

  // ── document-level mutators (head/foot/config/edge) ─────────
  const patchDoc = (patch) => {
    update((s) => {
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '' || (typeof v === 'object' && v && Object.keys(v).length === 0)) {
          delete s[k];
        } else {
          s[k] = v;
        }
      }
    });
  };
  const patchHeadFoot = (which, patch) => {
    update((s) => {
      const cur = s[which] ? { ...s[which] } : {};
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') delete cur[k]; else cur[k] = v;
      }
      if (Object.keys(cur).length === 0) delete s[which];
      else s[which] = cur;
    });
  };
  const patchConfig = (patch) => {
    update((s) => {
      const cur = s.config ? { ...s.config } : {};
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') delete cur[k]; else cur[k] = v;
      }
      if (Object.keys(cur).length === 0) delete s.config;
      else s.config = cur;
    });
  };
  const setEdges = (edges) => {
    update((s) => {
      if (!edges || !edges.length) delete s.edge;
      else s.edge = edges.slice();
    });
  };

  // ── samples ─────────────────────────────────────────────────
  const loadSample = (id) => {
    const s = window.WAVEDROM_SAMPLES.find((x) => x.id === id);
    if (s) setSpec(ensureIds(s.spec));
    setShowSamples(false);
  };

  // ── save / load / copy JSON ─────────────────────────────────
  const saveJson = () => {
    download('wavedrom.json', JSON.stringify(stripIds(spec), null, 2), 'application/json');
  };
  const loadJson = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json,.wavedrom';
    inp.onchange = (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try { setSpec(ensureIds(JSON.parse(r.result))); }
        catch (err) { alert('Could not parse JSON: ' + err.message); }
      };
      r.readAsText(f);
    };
    inp.click();
  };
  const copyJson = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(stripIds(spec), null, 2)); }
    catch (e) {}
  };

  // ── export ──────────────────────────────────────────────────
  const exportSvg = () => {
    const node = document.querySelector('.work .canvas-col');
    if (!node) return;
    // Collect all svg elements and concatenate
    const total = totalCycles(spec);
    const cw = t.cw;
    const wW = total * cw;
    const rows = flattenSignals(spec);
    const rowH = t.rowH;
    const labelW = 160;
    const totalH = rows.length * rowH + 32;

    // Build a simple combined SVG by reading each row's SVG markup.
    const rowSvgs = Array.from(document.querySelectorAll('.row .wave-svg'));
    let body = '';
    rowSvgs.forEach((svg, i) => {
      const inner = svg.innerHTML;
      body += `<g transform="translate(${labelW},${32 + i * rowH})">${inner}</g>`;
    });
    // Labels
    rows.forEach((r, i) => {
      const name = r.kind === 'group' ? r.name : (r.sig && r.sig.name) || '';
      body += `<text x="${labelW - 8}" y="${32 + i * rowH + rowH/2 + 4}" text-anchor="end"
        font-family="ui-sans-serif,system-ui" font-size="12" fill="#1f2328">${name}</text>`;
    });
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${labelW + wW}" height="${totalH}" viewBox="0 0 ${labelW + wW} ${totalH}">
<style>line,polygon,path{stroke:#1f2328;stroke-width:1.4;fill:none}polygon{fill:#d9e3f3}</style>
${body}
</svg>`;
    download('waveform.svg', svg, 'image/svg+xml');
  };

  const exportPng = async () => {
    // Render all svg rows onto a canvas and download.
    const total = totalCycles(spec);
    const cw = t.cw;
    const labelW = 160;
    const rowH = t.rowH;
    const rows = flattenSignals(spec);
    const W = labelW + total * cw;
    const H = rows.length * rowH + 32;
    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fafaf7';
    ctx.fillRect(0, 0, W, H);

    const svgs = Array.from(document.querySelectorAll('.row .wave-svg'));
    for (let i = 0; i < svgs.length; i++) {
      const node = svgs[i];
      const xml = new XMLSerializer().serializeToString(node);
      const url = 'data:image/svg+xml;utf8,' + encodeURIComponent(xml);
      const img = new Image();
      await new Promise((r, rej) => { img.onload = r; img.onerror = rej; img.src = url; });
      ctx.drawImage(img, labelW, 32 + i * rowH);
      const r = rows[i];
      const name = r.kind === 'group' ? r.name : (r.sig && r.sig.name) || '';
      ctx.fillStyle = '#1f2328';
      ctx.font = '12px ui-sans-serif, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(name, labelW - 8, 32 + i * rowH + rowH/2 + 4);
    }
    canvas.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'waveform.png'; a.click();
    });
  };

  // ── render ──────────────────────────────────────────────────
  const rows = useMemo(() => flattenSignals(spec), [spec]);
  const labelW = 160;

  return (
    <div className="app-shell" style={{ '--cw': t.cw + 'px', '--label-w': labelW + 'px' }}>
      <Toolbar
        addSignal={addSignal} addGroup={addGroup} delSignal={() => selectedId && deleteSignal(selectedId)}
        addCycle={addCycle} removeCycle={removeCycle}
        canUndo={history.current.length > 1} canRedo={future.current.length > 0}
        undo={undo} redo={redo}
        snap={t.snap} setSnap={(v) => setTweak('snap', v)}
        openSamples={() => setShowSamples(true)}
        openDoc={() => setDocPanel((v) => !v)} docOpen={docPanel}
        saveJson={saveJson} loadJson={loadJson} copyJson={copyJson}
        exportSvg={exportSvg} exportPng={exportPng}
      />
      <Workarea
        spec={spec} rows={rows} cycles={cycles} cw={t.cw} rowH={t.rowH}
        snap={t.snap}
        selectedId={selectedId} setSelectedId={setSelectedId}
        setWave={setWave} patchSig={patchSig} setTip={setTip}
        reorderSignal={reorderSignal}
        openCycleMenu={(info) => setCycleMenu(info)}
        moveEdgeEndpoint={moveEdgeEndpoint}
      />
      {edgeDraft && (
        <div className="edge-draft-banner">
          Edge draft: <b>{edgeDraft.letter}</b> →&nbsp;
          <span>right-click another cell to finish</span>
          <button onClick={cancelEdgeDraft} title="Cancel draft">✕</button>
        </div>
      )}
      <Drawer
        open={drawerOpen} setOpen={setDrawerOpen}
        text={jsonText} setText={setJsonText} apply={applyJson} error={jsonError}
        height={drawerH} setHeight={setDrawerH}
      />
      {docPanel && (
        <DocPanel
          spec={spec}
          patchHeadFoot={patchHeadFoot}
          patchConfig={patchConfig}
          setEdges={setEdges}
          close={() => setDocPanel(false)}
        />
      )}
      {selectedId && (
        <Inspector
          spec={spec} id={selectedId} patchSig={patchSig} setWave={setWave}
          close={() => setSelectedId(null)} deleteSignal={deleteSignal}
        />
      )}
      {cycleMenu && (() => {
        const f = findById(spec, cycleMenu.sigId);
        if (!f) return null;
        const w = f.sig.wave || '';
        const idx = cycleMenu.cycleIdx;
        const curCh = resolveWaveCh(w, idx);
        const isBus = BUS_CH.has(curCh);
        const dIdx = isBus ? busDataIdxFor(w, idx) : -1;
        const dArr = Array.isArray(f.sig.data) ? f.sig.data
          : f.sig.data ? String(f.sig.data).split(' ') : [];
        const busLabel = dIdx >= 0 ? (dArr[dIdx] || '') : '';
        const nodeLetter = nodeLetterAt(f.sig, idx) || '';
        return (
          <CycleMenu
            x={cycleMenu.x} y={cycleMenu.y}
            current={curCh}
            isBus={isBus}
            busLabel={busLabel}
            nodeLetter={nodeLetter}
            edgeDraft={edgeDraft}
            sigName={f.sig.name || ''}
            cycleIdx={idx}
            close={() => setCycleMenu(null)}
            onPick={(ch) => { setCycleChar(cycleMenu.sigId, idx, ch); setCycleMenu(null); }}
            onSetNode={(letter) => { setNodeLetter(cycleMenu.sigId, idx, letter); setCycleMenu(null); }}
            onSetBusLabel={(label) => { setBusLabel(cycleMenu.sigId, idx, label); setCycleMenu(null); }}
            onStartEdge={() => { startEdge(cycleMenu.sigId, idx); setCycleMenu(null); }}
            onFinishEdge={(op) => { finishEdge(cycleMenu.sigId, idx, op); setCycleMenu(null); }}
            onCancelEdgeDraft={() => { cancelEdgeDraft(); setCycleMenu(null); }}
          />
        );
      })()}
      {showSamples && <SampleModal close={() => setShowSamples(false)} load={loadSample} />}
      {tip && <div className="shadow-tip show">{tip}</div>}

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout" />
        <TweakSlider label="Cycle width" value={t.cw} min={16} max={120} step={2}
          onChange={(v) => setTweak('cw', v)} unit="px" />
        <TweakSlider label="Row height" value={t.rowH} min={28} max={64} step={2}
          onChange={(v) => setTweak('rowH', v)} unit="px" />
        <TweakSection label="Editing" />
        <TweakRadio label="Snap" value={String(t.snap)}
          options={['1', '0.5', '0.25']}
          onChange={(v) => setTweak('snap', parseFloat(v))} />
      </TweaksPanel>
    </div>
  );
}

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

// expose for split files
window.__WaveEditor = { App, Icon, ICONS, ensureIds, stripIds, flattenSignals,
  totalCycles, download, newId };
