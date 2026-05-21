// editor-views.jsx — sub-components: Toolbar, Workarea (waveform canvas),
// Drawer, Inspector, SampleModal.

import React, { useState as uS, useEffect as uE, useMemo as uM, useRef as uR, useCallback as uCB } from 'react';
import * as WR from './wave-render.js';
import { ICONS } from './icons.jsx';
import { SAMPLES } from './samples.js';

// ── Toolbar ────────────────────────────────────────────────────
function Toolbar(p) {
  return (
    <div className="toolbar">
      <div className="brand"><span className="dot"></span>Wavedrom Editor</div>

      <div className="tb-group">
        <button className="tb-btn" title="Add signal (A)" onClick={p.addSignal}>{ICONS.add} Signal</button>
        <button className="tb-btn" title="Add group" onClick={p.addGroup}>{ICONS.group} Group</button>
        <button className="tb-btn" title="Delete (Del)" onClick={p.delSignal}>{ICONS.trash}</button>
      </div>

      <div className="tb-group">
        <button className="tb-btn" title="Add cycle to all" onClick={p.addCycle}>{ICONS.cycleAdd} +cycle</button>
        <button className="tb-btn" title="Remove last cycle" onClick={p.removeCycle}>{ICONS.cycleDel} −cycle</button>
      </div>

      <div className="tb-group">
        <button className="tb-btn" title="Undo (⌘Z)" onClick={p.undo} disabled={!p.canUndo}>{ICONS.undo}</button>
        <button className="tb-btn" title="Redo (⌘⇧Z)" onClick={p.redo} disabled={!p.canRedo}>{ICONS.redo}</button>
      </div>

      <div className="tb-group" title="Snap granularity">
        <span style={{ color: 'var(--ink-3)', fontSize: 11, marginRight: 6 }}>Snap</span>
        <select className="tb-select" value={String(p.snap)} onChange={(e) => p.setSnap(parseFloat(e.target.value))}>
          <option value="1">1.0</option>
          <option value="0.5">0.5</option>
          <option value="0.25">0.25</option>
        </select>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <button className={'tb-btn' + (p.docOpen ? ' primary' : '')} onClick={p.openDoc}
          title="Document properties (head/foot/config/edges)">📄 Doc</button>
        <button className="tb-btn" onClick={p.openSamples}>{ICONS.samples} Samples</button>
      </div>
      <div className="tb-group">
        <button className="tb-btn" onClick={p.saveJson} title="Download as .json">💾 Save</button>
        <button className="tb-btn" onClick={p.loadJson} title="Open a .json file">📂 Open</button>
        <button className="tb-btn" onClick={p.copyJson} title="Copy JSON to clipboard">⧉ Copy</button>
      </div>
      <div className="tb-group">
        <button className="tb-btn" onClick={p.exportSvg}>{ICONS.svg} SVG</button>
        <button className="tb-btn" onClick={p.exportPng}>{ICONS.png} PNG</button>
      </div>
    </div>
  );
}

// ── Workarea ───────────────────────────────────────────────────
function Workarea({ spec, rows, cycles, cw, rowH, snap, selectedId, setSelectedId,
                    setWave, patchSig, setTip, reorderSignal, openCycleMenu, moveEdgeEndpoint }) {
  const totalW = cycles * cw;
  const [dragRow, setDragRow] = uS(null); // {id, y}
  const [dropTarget, setDropTarget] = uS(null); // {id, position}

  // drag-reorder a row
  const beginRowDrag = (e, id) => {
    e.preventDefault();
    setDragRow({ id });
    const onMove = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const rowEl = el && el.closest && el.closest('.row[data-id]');
      if (rowEl) {
        const tid = rowEl.getAttribute('data-id');
        if (tid && tid !== id) {
          const r = rowEl.getBoundingClientRect();
          const pos = ev.clientY < r.top + r.height / 2 ? 'above' : 'below';
          setDropTarget({ id: tid, position: pos });
          return;
        }
      }
      setDropTarget(null);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragRow((cur) => {
        setDropTarget((dt) => {
          if (cur && dt) reorderSignal(cur.id, dt.id, dt.position);
          return null;
        });
        return null;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="work">
      <div className="wave-host" style={{ '--cw': cw + 'px' }}>
        {/* sticky label column */}
        <div className="label-col">
          <div className="lc-head">Signals</div>
          {rows.map((r, i) => (
            <RowLabel key={(r.sig && r.sig.__id) || ('row-' + i)} r={r} h={rowH}
              selected={selectedId === (r.sig && r.sig.__id)}
              dragging={dragRow && dragRow.id === (r.sig && r.sig.__id)}
              dropAbove={dropTarget && dropTarget.id === (r.sig && r.sig.__id) && dropTarget.position === 'above'}
              dropBelow={dropTarget && dropTarget.id === (r.sig && r.sig.__id) && dropTarget.position === 'below'}
              onSelect={() => r.sig && r.sig.__id && setSelectedId(r.sig.__id)}
              onName={(name) => r.sig && r.sig.__id && patchSig(r.sig.__id, { name })}
              beginDrag={(e) => r.sig && r.sig.__id && beginRowDrag(e, r.sig.__id)}
            />
          ))}
        </div>

        {/* canvas column */}
        <div className="canvas-col" style={{ width: totalW }}>
          <div className="cc-head" style={{ width: totalW }}>
            {Array.from({ length: cycles }).map((_, i) => (
              <div key={i} className={'tick' + (i % 4 === 0 ? ' major' : '')}>{i}</div>
            ))}
          </div>
          <div className="cc-body">
            {rows.map((r, i) => (
              <WaveRow key={(r.sig && r.sig.__id) || ('w-' + i)}
                r={r} h={rowH} cw={cw} cycles={cycles} totalW={totalW} snap={snap}
                selected={selectedId === (r.sig && r.sig.__id)}
                onSelect={() => r.sig && r.sig.__id && setSelectedId(r.sig.__id)}
                setWave={(w) => r.sig && r.sig.__id && setWave(r.sig.__id, w)}
                patchSig={(p) => r.sig && r.sig.__id && patchSig(r.sig.__id, p)}
                setTip={setTip}
                openCycleMenu={openCycleMenu}
              />
            ))}
            <EdgeLayer spec={spec} rows={rows} cw={cw} rowH={rowH} moveEdgeEndpoint={moveEdgeEndpoint} setTip={setTip} />
          </div>
        </div>
      </div>

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6"
                   patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" strokeWidth="1.2" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

// ── Row label ──────────────────────────────────────────────────
function RowLabel({ r, h, selected, dragging, dropAbove, dropBelow, onSelect, onName, beginDrag }) {
  const cls = ['row', r.kind === 'group' ? 'group' : '', r.depth > 0 ? 'child' : '',
    selected ? 'selected' : '', dragging ? 'dragging' : '',
    dropAbove ? 'drop-above' : '', dropBelow ? 'drop-below' : ''].filter(Boolean).join(' ');
  if (r.kind === 'group') {
    return (
      <div className={cls} style={{ height: h }} onClick={onSelect}>
        <div className="label">
          <div className="grip" onMouseDown={beginDrag} />
          <div className="name" contentEditable suppressContentEditableWarning
               onBlur={(e) => onName(e.currentTarget.textContent)}>{r.name}</div>
        </div>
      </div>
    );
  }
  if (r.kind === 'spacer' || r.kind === 'empty') {
    return <div className={cls} style={{ height: h }}><div className="label" /></div>;
  }
  const sig = r.sig;
  const meta = (sig.period && sig.period !== 1 ? `×${sig.period} ` : '')
             + (sig.phase ? `φ${sig.phase}` : '');
  return (
    <div className={cls} style={{ height: h }} data-id={sig.__id} onClick={onSelect}>
      <div className="label">
        <div className="grip" onMouseDown={beginDrag} />
        <div className="name" contentEditable suppressContentEditableWarning
             onBlur={(e) => onName(e.currentTarget.textContent)}>{sig.name || ''}</div>
        {meta && <span className="meta">{meta}</span>}
      </div>
    </div>
  );
}

// ── Wave row (svg with drag handles) ──────────────────────────
function WaveRow({ r, h, cw, cycles, totalW, snap, selected, onSelect, setWave, patchSig, setTip, openCycleMenu }) {
  const svgRef = uR(null);

  if (r.kind !== 'signal') {
    return <div className={'row ' + (r.kind === 'group' ? 'group' : '')}
                style={{ height: h }} data-id={r.sig && r.sig.__id} />;
  }
  const sig = r.sig;
  const period = sig.period || 1;
  const phase = sig.phase || 0;
  const segs = uM(() => WR.parseWave(sig.wave || ''), [sig.wave]);
  const data = sig.data ? (Array.isArray(sig.data) ? sig.data : sig.data.split(' ')) : [];
  const { els, transitions } = uM(
    () => WR.renderWave(segs, { cw, period, h, pad: Math.max(6, h * 0.18), phase, dataLabels: data }),
    [segs, cw, period, h, phase, data.join('|')]
  );

  // render React elements from element tuples — default stroke for line/path
  const svgChildren = els.map((el, i) => {
    const [tag, props, ...kids] = el;
    let p = props;
    if (tag === 'line' || tag === 'path') {
      p = Object.assign({ stroke: 'currentColor', strokeWidth: 1.4, fill: 'none' }, props);
    }
    return React.createElement(tag, p, ...kids);
  });

  // ── interactions ──
  const wave = sig.wave || '';

  // Click/cycle: rewrite at the click position (creating a new segment if needed).
  // Cycles loop 0 → 1 → x → z → = → 0 …
  const onCycleClick = (cycleIdx) => {
    if (cycleIdx < 0 || cycleIdx >= wave.length) return;
    // walk back through dots/gaps to find the current value at this position
    let lookup = cycleIdx;
    while (lookup > 0 && (wave[lookup] === '.' || wave[lookup] === '|')) lookup--;
    const curCh = wave[lookup] || '0';
    const nxt = WR.nextValue(curCh);
    const newWave = WR.setCharAt(wave, cycleIdx, nxt);
    setWave(newWave);
    setTip(`cycle ${cycleIdx} → ${nxt}`); setTimeout(() => setTip(null), 800);
  };

  // Begin drag of a transition handle
  const beginTransitionDrag = (tr, evt) => {
    evt.stopPropagation(); evt.preventDefault();
    const startX = evt.clientX;
    const originCharIdx = tr.charIndex;
    // Track current state across move events — the wave string and the char's
    // position both shift as the user drags. Without this, the closure keeps
    // pointing at the original index, which becomes a '.' after the first move
    // and prevents dragging back.
    let curWave = wave;
    let curCharIdx = originCharIdx;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dCells = Math.round(dx / (cw * snap)) * snap;
      const targetCharIdx = Math.max(0, Math.min(curWave.length - 1,
        Math.round(originCharIdx + dCells / period)));
      const result = WR.moveTransition(curWave, curCharIdx, targetCharIdx);
      if (result.wave !== curWave) {
        curWave = result.wave;
        curCharIdx = result.idx;
        setWave(curWave);
      }
      setTip(`edge → cycle ${curCharIdx}`);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTip(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Phase handle: drag entire signal horizontally
  const beginPhaseDrag = (evt) => {
    evt.stopPropagation(); evt.preventDefault();
    const startX = evt.clientX;
    const startPhase = phase;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dCycles = -dx / cw; // dragging right reduces phase (which shifts left in wavedrom)
      const newPhase = Math.round((startPhase + dCycles) / snap) * snap;
      patchSig({ phase: newPhase === 0 ? 0 : newPhase });
      setTip(`phase ${newPhase.toFixed(2)}`);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTip(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Period handle: drag the right-edge to change period multiplier
  const beginPeriodDrag = (evt) => {
    evt.stopPropagation(); evt.preventDefault();
    const startX = evt.clientX;
    const startPeriod = period;
    const totalChars = wave.length;
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const desiredTotalPx = startPeriod * totalChars * cw + dx;
      let newPeriod = desiredTotalPx / (totalChars * cw);
      // snap to 0.5
      newPeriod = Math.max(0.25, Math.round(newPeriod / 0.25) * 0.25);
      patchSig({ period: newPeriod });
      setTip(`period ×${newPeriod}`);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setTip(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // hit areas
  const phaseHandleW = 6;
  const phaseHandleX = -phase * cw;
  const offset = -phase * cw;

  return (
    <div className={'row' + (selected ? ' selected' : '')} style={{ height: h }} data-id={sig.__id}
         onClick={onSelect}>
      <svg ref={svgRef} className={'wave-svg' + (cw >= 28 ? ' major-grid' : '')}
           width={totalW} height={h} style={{ color: 'var(--ink)' }}>
        {svgChildren}

        {/* cycle hit areas — must render *after* the wave shapes so they capture
            clicks that would otherwise be eaten by bus polygons / hatched x fills */}
        {Array.from({ length: cycles }).map((_, i) => {
          const x = i * cw;
          if (i >= wave.length) return null;
          // resolve "current" char at this position (walk back through dots/gaps)
          let lookup = i;
          while (lookup > 0 && (wave[lookup] === '.' || wave[lookup] === '|')) lookup--;
          const curCh = wave[lookup] || '0';
          return (
            <rect key={'hit-' + i} className="cycle-hit"
              x={x} y={0} width={cw} height={h} fill="transparent"
              onClick={(e) => { e.stopPropagation(); onCycleClick(i); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                openCycleMenu && openCycleMenu({
                  x: e.clientX, y: e.clientY,
                  sigId: sig.__id, cycleIdx: i, current: curCh,
                });
              }}
            />
          );
        })}

        {/* transition handles — only show where the edge can actually be moved */}
        {transitions.filter(tr => tr.movable).map((tr, i) => {
          const x = -phase * cw + tr.charIndex * cw * period;
          return (
            <rect key={'tr-' + i}
              className="handle transition"
              x={x - 5} y={2} width={10} height={h - 4}
              onMouseDown={(e) => beginTransitionDrag(tr, e)}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setTip(`drag edge — cycle ${tr.charIndex}`)}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}

        {/* phase handle (left edge of signal) */}
        {phase !== 0 || true ? (
          <rect className="phase-handle"
            x={offset - phaseHandleW/2} y={3} width={phaseHandleW} height={h - 6}
            onMouseDown={beginPhaseDrag}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setTip('drag phase (φ)')}
            onMouseLeave={() => setTip(null)}
          />
        ) : null}

        {/* period handle (right edge of signal) */}
        <rect className="period-handle-rect"
          x={offset + wave.length * cw * period - 4} y={3} width={8} height={h - 6}
          onMouseDown={beginPeriodDrag}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setTip('drag period (×)')}
          onMouseLeave={() => setTip(null)}
        />
      </svg>
    </div>
  );
}

// ── Edge layer (arrows between signals) ─────────────────────────
function EdgeLayer({ spec, rows, cw, rowH, moveEdgeEndpoint, setTip }) {
  const svgRef = uR(null);
  const [drag, setDrag] = uS(null); // {edgeIdx, end, x, y, hoverRow, hoverCycle}

  // Build nodeMap from rows
  const nodeMap = {};
  rows.forEach((r, rowIdx) => {
    if (r.kind !== 'signal') return;
    const sig = r.sig;
    const nodes = sig.node || '';
    const period = sig.period || 1;
    const phase = sig.phase || 0;
    for (let i = 0; i < nodes.length; i++) {
      const c = nodes[i];
      if (c && c !== '.' && c !== ' ') {
        const x = (-phase + i * period) * cw;
        // EdgeLayer is positioned inside .cc-body, so coords are relative to
        // the body — no header offset needed.
        const y = rowIdx * rowH + rowH / 2;
        nodeMap[c] = { x, y, sigId: sig.__id, rowIdx, charIdx: i };
      }
    }
  });
  const edges = (spec.edge || []).map((e, i) => {
    // Format: "<from><op><to> [label]"; ops: -, ->, <->, ~>, ~, -|>, etc.
    const m = String(e).match(/^([^\s\-~<>|]+)([\-~<>|]+)([^\s]+)\s*(.*)$/);
    if (!m) return null;
    const [, from, op, to, label] = m;
    const a = nodeMap[from], b = nodeMap[to];
    if (!a || !b) return null;
    return { i, from, to, op, label, a, b };
  }).filter(Boolean);

  if (!edges.length && !drag) return null;

  const totalW = rows.length ? Math.max(...rows.map((r) => r.kind === 'signal'
    ? ((r.sig.wave || '').length * (r.sig.period || 1) - (r.sig.phase || 0)) * cw : 0)) : 0;
  const totalH = rows.length * rowH;

  // local coords from clientX/Y
  const toLocal = (cx, cy) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: cx - rect.left, y: cy - rect.top };
  };
  // resolve drop target {rowIdx, cycleIdx, sigId} or null
  const targetFor = (lx, ly) => {
    const rowIdx = Math.floor(ly / rowH);
    if (rowIdx < 0 || rowIdx >= rows.length) return null;
    const row = rows[rowIdx];
    if (row.kind !== 'signal') return null;
    const sig = row.sig;
    const period = sig.period || 1;
    const phase = sig.phase || 0;
    const cycleIdx = Math.floor((lx / cw + phase) / period);
    if (cycleIdx < 0 || cycleIdx >= (sig.wave || '').length) return null;
    return { rowIdx, cycleIdx, sigId: sig.__id };
  };

  const beginHandleDrag = (e, edge, end) => {
    e.preventDefault(); e.stopPropagation();
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDrag({ edgeIdx: edge.i, end, x, y, hoverRow: -1, hoverCycle: -1 });
    setTip && setTip(`drag onto another cell to move "${end === 'a' ? edge.from : edge.to}"`);
    const onMove = (ev) => {
      const { x, y } = toLocal(ev.clientX, ev.clientY);
      const t = targetFor(x, y);
      setDrag((d) => d && ({ ...d, x, y, hoverRow: t ? t.rowIdx : -1, hoverCycle: t ? t.cycleIdx : -1 }));
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const { x, y } = toLocal(ev.clientX, ev.clientY);
      const t = targetFor(x, y);
      if (t && moveEdgeEndpoint) moveEdgeEndpoint(edge.i, end, t.sigId, t.cycleIdx);
      setDrag(null);
      setTip && setTip(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const renderEdge = (e) => {
    const { a, b, op, label, i } = e;
    // override an endpoint while being dragged
    let aPos = a, bPos = b;
    if (drag && drag.edgeIdx === i) {
      if (drag.end === 'a') aPos = { x: drag.x, y: drag.y };
      else                  bPos = { x: drag.x, y: drag.y };
    }
    const isCurve = op.includes('~');
    const dy = bPos.y - aPos.y;
    const cx = (aPos.x + bPos.x) / 2, cy = (aPos.y + bPos.y) / 2;
    const d = isCurve
      ? `M ${aPos.x} ${aPos.y} Q ${cx} ${cy - Math.abs(dy)/2} ${bPos.x} ${bPos.y}`
      : `M ${aPos.x} ${aPos.y} L ${bPos.x} ${bPos.y}`;
    const startArrow = op.startsWith('<');
    const endArrow   = op.endsWith('>');
    const isDragging = !!(drag && drag.edgeIdx === i);
    return (
      <g key={i} className={'edge' + (isDragging ? ' dragging' : '')}>
        <path className="edge-path" d={d}
          markerStart={startArrow ? 'url(#edge-arrow)' : undefined}
          markerEnd={endArrow ? 'url(#edge-arrow)' : undefined} />
        <circle className="edge-node" cx={a.x} cy={a.y} r="2.5" />
        <circle className="edge-node" cx={b.x} cy={b.y} r="2.5" />
        <circle className="edge-handle"
          cx={aPos.x} cy={aPos.y} r="6"
          onMouseDown={(ev) => beginHandleDrag(ev, e, 'a')}>
          <title>{`${e.from} — drag to reconnect`}</title>
        </circle>
        <circle className="edge-handle"
          cx={bPos.x} cy={bPos.y} r="6"
          onMouseDown={(ev) => beginHandleDrag(ev, e, 'b')}>
          <title>{`${e.to} — drag to reconnect`}</title>
        </circle>
        {label && (
          <text className="edge-label" x={cx} y={cy - 6} textAnchor="middle">{label}</text>
        )}
      </g>
    );
  };

  // Drop-target highlight while dragging
  let dropHL = null;
  if (drag && drag.hoverRow >= 0 && drag.hoverCycle >= 0) {
    const row = rows[drag.hoverRow];
    if (row && row.kind === 'signal') {
      const sig = row.sig;
      const period = sig.period || 1;
      const phase = sig.phase || 0;
      const hx = (-phase + drag.hoverCycle * period) * cw; // left edge of the cell (node anchor)
      const hy = drag.hoverRow * rowH;
      const cellW = cw * period;
      dropHL = (
        <g className="edge-drop-hl">
          {/* faint cell context */}
          <rect x={hx} y={hy} width={cellW} height={rowH} />
          {/* actual snap point: left edge of the cell, at row centerline */}
          <line x1={hx} y1={hy + 3} x2={hx} y2={hy + rowH - 3} />
          <circle cx={hx} cy={hy + rowH / 2} r="5" />
        </g>
      );
    }
  }

  return (
    <svg ref={svgRef} className={'edge-svg' + (drag ? ' dragging' : '')}
         width={totalW + 24} height={totalH}>
      <defs>
        <marker id="edge-arrow" viewBox="0 0 12 12" refX="11" refY="6"
                markerWidth="9" markerHeight="9" orient="auto-start-reverse"
                markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 12 6 L 0 12 L 3 6 z" fill="var(--warn)" />
        </marker>
      </defs>
      {dropHL}
      {edges.map(renderEdge)}
    </svg>
  );
}

// ── JSON drawer ────────────────────────────────────────────────
function Drawer({ open, setOpen, text, setText, apply, error, height, setHeight }) {
  const [local, setLocal] = uS(text);
  uE(() => setLocal(text), [text]);
  const onChange = (v) => { setLocal(v); apply(v); };

  const beginResize = (e) => {
    e.preventDefault();
    if (!open) setOpen(true);
    const startY = e.clientY;
    const startH = height;
    const maxH = Math.max(120, window.innerHeight - 140); // leave room for toolbar + canvas
    const onMove = (ev) => {
      const dy = startY - ev.clientY; // drag up → grow
      const next = Math.max(80, Math.min(maxH, startH + dy));
      setHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const onResizeDouble = () => {
    // double-click toggles collapse
    setOpen(!open);
  };

  return (
    <div className={'drawer' + (open ? '' : ' collapsed')}
         style={open ? { height: height } : undefined}>
      <div className="drawer-resize"
           onMouseDown={beginResize}
           onDoubleClick={onResizeDouble}
           title="Drag to resize · double-click to collapse">
        <span className="drawer-resize-grip" />
      </div>
      <div className="drawer-head" onClick={() => setOpen(!open)}>
        <span className="chev">▼</span> JSON
        <span className="drawer-tools" onClick={(e) => e.stopPropagation()}>
          {error
            ? <span className="json-status bad">parse error: {error}</span>
            : <span className="json-status">live · syncs to canvas</span>}
        </span>
      </div>
      <div className="drawer-body">
        <textarea className={'json-area' + (error ? ' bad' : '')} spellCheck={false}
          value={local} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

// ── Inspector ──────────────────────────────────────────────────
function Inspector({ spec, id, patchSig, setWave, close, deleteSignal }) {
  const pos = uR(null); // {x, y} — null = use CSS default
  const drag = uR(null); // {startX, startY, ox, oy}
  const [, forceUpdate] = uS(0);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const cur = pos.current || { x: window.innerWidth - 252, y: 56 };
    drag.current = { startX: e.clientX, startY: e.clientY, ox: cur.x, oy: cur.y };
    const onMove = (e2) => {
      const nx = drag.current.ox + e2.clientX - drag.current.startX;
      const ny = drag.current.oy + e2.clientY - drag.current.startY;
      pos.current = { x: Math.max(0, nx), y: Math.max(0, ny) };
      forceUpdate(n => n + 1);
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  // find sig
  let sig = null;
  const visit = (n) => {
    if (sig) return;
    if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) visit(n[i]); return; }
    if (n && typeof n === 'object' && n.__id === id) sig = n;
  };
  if (Array.isArray(spec.signal)) spec.signal.forEach(visit);
  if (!sig) return null;
  const period = sig.period || 1;
  const phase = sig.phase || 0;
  const data = sig.data ? (Array.isArray(sig.data) ? sig.data.join(' ') : sig.data) : '';

  const style = pos.current
    ? { left: pos.current.x, top: pos.current.y, right: 'auto' }
    : undefined;

  return (
    <div className="inspector" style={style} onClick={(e) => e.stopPropagation()}>
      <h4 onMouseDown={onMouseDown} style={{ cursor: 'grab' }}>Signal · {sig.name}</h4>
      <div className="insp-row"><label>Name</label>
        <input value={sig.name || ''} onChange={(e) => patchSig(id, { name: e.target.value })} />
      </div>
      <div className="insp-row"><label>Wave</label>
        <input className="wave-input" value={sig.wave || ''}
          onChange={(e) => setWave(id, e.target.value)} spellCheck={false} />
      </div>
      <div className="insp-row"><label>Phase</label>
        <div className="stepper">
          <button onClick={() => patchSig(id, { phase: phase - 0.25 })}>−</button>
          <input type="number" step="0.25" value={phase}
            onChange={(e) => patchSig(id, { phase: parseFloat(e.target.value) || 0 })} />
          <button onClick={() => patchSig(id, { phase: phase + 0.25 })}>+</button>
        </div>
      </div>
      <div className="insp-row"><label>Period</label>
        <div className="stepper">
          <button onClick={() => patchSig(id, { period: Math.max(0.25, period - 0.25) })}>−</button>
          <input type="number" step="0.25" min="0.25" value={period}
            onChange={(e) => patchSig(id, { period: Math.max(0.25, parseFloat(e.target.value) || 1) })} />
          <button onClick={() => patchSig(id, { period: period + 0.25 })}>+</button>
        </div>
      </div>
      <div className="insp-row"><label>Data</label>
        <input value={data} placeholder="bus labels (space-sep)"
          onChange={(e) => patchSig(id, { data: e.target.value.split(/\s+/).filter(Boolean) })} />
      </div>
      <div className="insp-row"><label>Node</label>
        <input value={sig.node || ''} placeholder="e.g. .a..b" spellCheck={false}
          onChange={(e) => patchSig(id, { node: e.target.value })} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <button className="tb-btn" onClick={() => deleteSignal(id)} style={{ color: '#b13a3a' }}>
          {ICONS.trash} Delete
        </button>
        <button className="tb-btn" onClick={close}>Close</button>
      </div>
    </div>
  );
}

// ── Sample modal ───────────────────────────────────────────────
function SampleModal({ close, load }) {
  return (
    <div className="dim-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Load a sample</h3>
        <div className="sample-list">
          {SAMPLES.map((s) => (
            <button key={s.id} onClick={() => load(s.id)}>
              <span>{s.label}</span>
              <span className="sub">{s.sub}</span>
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <button className="ghost" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Document panel (head/foot/config + edges) ─────────────────
const EDGE_OPS = ['-', '->', '<-', '<->', '~', '~>', '<~', '<~>', '-|', '|->', '-|>', '<-|', '-~', '~-'];

function DocPanel({ spec, patchHeadFoot, patchConfig, setEdges, close }) {
  const head = spec.head || {};
  const foot = spec.foot || {};
  const config = spec.config || {};
  const edges = Array.isArray(spec.edge) ? spec.edge : [];

  // section open/closed state — persist in localStorage
  const [openSet, setOpenSet] = uS(() => {
    try {
      const raw = localStorage.getItem('wde.docOpen');
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set(['edges']); // edges open by default
  });
  uE(() => {
    try { localStorage.setItem('wde.docOpen', JSON.stringify([...openSet])); } catch (e) {}
  }, [openSet]);
  const toggle = (k) => setOpenSet((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const isOpen = (k) => openSet.has(k);

  // Collect available nodes across all signals for autocomplete + tooltips
  const nodes = uM(() => {
    const out = [];
    const visit = (n, gname) => {
      if (Array.isArray(n)) { for (let i = 1; i < n.length; i++) visit(n[i], n[0]); return; }
      if (n && typeof n === 'object' && n.node) {
        const sn = n.name || gname || '';
        for (let i = 0; i < n.node.length; i++) {
          const c = n.node[i];
          if (/[A-Za-z]/.test(c)) out.push({ letter: c, signal: sn, cycle: i });
        }
      }
    };
    if (Array.isArray(spec.signal)) spec.signal.forEach((s) => visit(s));
    return out;
  }, [spec]);
  const nodeTip = nodes.length
    ? 'Available nodes:\n' + nodes.map(n => `  ${n.letter}  ${n.signal} @ cycle ${n.cycle}`).join('\n')
    : 'No nodes yet. Right-click a wave cell → "Start edge from here", or set a node letter manually.';

  // edges are strings like "a~>b some label" — parse into structured form
  const parseEdge = (s) => {
    const m = String(s).match(/^([A-Za-z])([\-~<|>]+)([A-Za-z])\s*(.*)$/);
    if (!m) return { from: '', op: '-', to: '', label: String(s) };
    return { from: m[1], op: m[2], to: m[3], label: m[4] || '' };
  };
  const fmtEdge = ({ from, op, to, label }) =>
    `${from || ''}${op || '-'}${to || ''}${label ? ' ' + label : ''}`;

  const setEdgeAt = (i, patch) => {
    const next = edges.slice();
    next[i] = fmtEdge({ ...parseEdge(next[i]), ...patch });
    setEdges(next);
  };
  const addEdge = () => {
    // suggest first two available node letters
    const a = nodes[0] ? nodes[0].letter : 'a';
    const b = nodes[1] ? nodes[1].letter : 'b';
    setEdges([...edges, `${a}->${b}`]);
  };
  const delEdge = (i) => { const n = edges.slice(); n.splice(i, 1); setEdges(n); };

  const SectionHead = ({ k, title, hint, right }) => (
    <div className="dp-section-title" onClick={() => toggle(k)} title={hint || undefined}>
      <span className="dp-chev" style={{ transform: isOpen(k) ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
      <span className="dp-section-name">{title}</span>
      {right && <span className="dp-section-right" onClick={(e) => e.stopPropagation()}>{right}</span>}
    </div>
  );

  return (
    <div className="inspector doc-panel" onClick={(e) => e.stopPropagation()}>
      <div className="dp-head">
        <h4>Document</h4>
        <button className="dp-close" onClick={close} title="Close">✕</button>
      </div>

      <div className="dp-section">
        <SectionHead k="head" title="Header" />
        {isOpen('head') && (<div className="dp-section-body">
          <div className="insp-row"><label>Text</label>
            <input value={head.text || ''} placeholder="title above canvas"
              onChange={(e) => patchHeadFoot('head', { text: e.target.value })} />
          </div>
          <div className="insp-row"><label>Tick</label>
            <input type="number" value={head.tick ?? ''} placeholder="start # (e.g. 0)"
              onChange={(e) => patchHeadFoot('head', { tick: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
          <div className="insp-row"><label>Tock</label>
            <input type="number" value={head.tock ?? ''} placeholder="start # (e.g. 1)"
              onChange={(e) => patchHeadFoot('head', { tock: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
          <div className="insp-row"><label>Every</label>
            <input type="number" min="1" value={head.every ?? ''} placeholder="N"
              onChange={(e) => patchHeadFoot('head', { every: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
        </div>)}
      </div>

      <div className="dp-section">
        <SectionHead k="foot" title="Footer" />
        {isOpen('foot') && (<div className="dp-section-body">
          <div className="insp-row"><label>Text</label>
            <input value={foot.text || ''} placeholder="caption below canvas"
              onChange={(e) => patchHeadFoot('foot', { text: e.target.value })} />
          </div>
          <div className="insp-row"><label>Tick</label>
            <input type="number" value={foot.tick ?? ''} placeholder="start #"
              onChange={(e) => patchHeadFoot('foot', { tick: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
          <div className="insp-row"><label>Tock</label>
            <input type="number" value={foot.tock ?? ''} placeholder="start #"
              onChange={(e) => patchHeadFoot('foot', { tock: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
          <div className="insp-row"><label>Every</label>
            <input type="number" min="1" value={foot.every ?? ''} placeholder="N"
              onChange={(e) => patchHeadFoot('foot', { every: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
          </div>
        </div>)}
      </div>

      <div className="dp-section">
        <SectionHead k="config" title="Config" />
        {isOpen('config') && (<div className="dp-section-body">
          <div className="insp-row"><label>hscale</label>
            <input type="number" min="0.25" step="0.25" value={config.hscale ?? ''} placeholder="1"
              onChange={(e) => patchConfig({ hscale: e.target.value === '' ? null : parseFloat(e.target.value) })} />
          </div>
          <div className="insp-row"><label>skin</label>
            <select value={config.skin || ''}
              onChange={(e) => patchConfig({ skin: e.target.value || null })}>
              <option value="">default</option>
              <option value="narrow">narrow</option>
              <option value="lowkey">lowkey</option>
            </select>
          </div>
          <div className="insp-row"><label>marks</label>
            <select value={config.marks ? 'true' : 'false'}
              onChange={(e) => patchConfig({ marks: e.target.value === 'true' ? true : null })}>
              <option value="false">off</option>
              <option value="true">on</option>
            </select>
          </div>
        </div>)}
      </div>

      <div className="dp-section">
        <SectionHead k="edges" title="Edges"
          hint={nodeTip}
          right={
            <button className="dp-add" onClick={(e) => { e.stopPropagation(); if (!isOpen('edges')) toggle('edges'); addEdge(); }}
              title="Add edge">+ edge</button>
          }
        />
        {isOpen('edges') && (<div className="dp-section-body">
          <datalist id="dp-node-list">
            {nodes.map((n, i) => (
              <option key={n.letter + '-' + i} value={n.letter}>{n.signal} @ cycle {n.cycle}</option>
            ))}
          </datalist>
          {nodes.length === 0 && (
            <div className="dp-empty">
              No node tags yet. Right-click a wave cell → <b>"Start edge from here"</b>,
              or type a single letter into <code>node</code> on a signal.
            </div>
          )}
          {nodes.length > 0 && edges.length === 0 && (
            <div className="dp-empty">
              {nodes.length} node{nodes.length === 1 ? '' : 's'} available: {nodes.map(n => n.letter).join(', ')}. Click <b>+ edge</b> to connect two.
            </div>
          )}
          {edges.map((e, i) => {
            const ed = parseEdge(e);
            return (
              <div className="dp-edge-row" key={i} title={nodeTip}>
                <input className="dp-edge-node" list="dp-node-list" maxLength={1} value={ed.from}
                  onChange={(ev) => setEdgeAt(i, { from: ev.target.value.slice(0,1) })}
                  placeholder="a" title={nodeTip} />
                <select className="dp-edge-op" value={ed.op}
                  onChange={(ev) => setEdgeAt(i, { op: ev.target.value })}>
                  {EDGE_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input className="dp-edge-node" list="dp-node-list" maxLength={1} value={ed.to}
                  onChange={(ev) => setEdgeAt(i, { to: ev.target.value.slice(0,1) })}
                  placeholder="b" title={nodeTip} />
                <input className="dp-edge-label" value={ed.label}
                  onChange={(ev) => setEdgeAt(i, { label: ev.target.value })} placeholder="label" />
                <button className="dp-edge-del" onClick={() => delEdge(i)} title="Remove this edge">−</button>
              </div>
            );
          })}
        </div>)}
      </div>
    </div>
  );
}


const CYCLE_MENU_GROUPS = [
  { label: 'Logic', items: [
      { ch: '0', desc: 'low' },
      { ch: '1', desc: 'high' },
      { ch: 'l', desc: 'low (faded)' },
      { ch: 'h', desc: 'high (faded)' },
    ] },
  { label: 'Special', items: [
      { ch: 'x', desc: "don't-care" },
      { ch: 'z', desc: 'hi-Z' },
      { ch: '.', desc: 'extend prev' },
      { ch: '|', desc: 'gap' },
    ] },
  { label: 'Clock', items: [
      { ch: 'p', desc: 'pos clock' },
      { ch: 'n', desc: 'neg clock' },
      { ch: 'P', desc: 'pos w/ arrow' },
      { ch: 'N', desc: 'neg w/ arrow' },
    ] },
  { label: 'Bus', items: [
      { ch: '=', desc: 'bus (blue)' },
      { ch: '2', desc: 'bus (orange)' },
      { ch: '3', desc: 'bus (green)' },
      { ch: '4', desc: 'bus (red)' },
      { ch: '5', desc: 'bus (purple)' },
    ] },
];

function CycleMenu({ x, y, current, isBus, busLabel, nodeLetter, edgeDraft, sigName, cycleIdx,
                    close, onPick, onSetNode, onSetBusLabel, onStartEdge, onFinishEdge, onCancelEdgeDraft }) {
  const [busInput, setBusInput] = uS(busLabel || '');
  const [nodeInput, setNodeInput] = uS(nodeLetter || '');
  uE(() => setBusInput(busLabel || ''), [busLabel]);
  uE(() => setNodeInput(nodeLetter || ''), [nodeLetter]);
  uE(() => {
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.cycle-menu')) return;
      close();
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [close]);
  // clamp to viewport
  const W = 240, H = 460;
  const left = Math.min(x, window.innerWidth - W - 8);
  const top  = Math.min(y, window.innerHeight - H - 8);

  const hasDraft = !!edgeDraft;

  return (
    <div className="cycle-menu" style={{ left, top }}>
      <div className="cm-status">
        <span className="cm-status-cell">{sigName || 'signal'} · cycle {cycleIdx}</span>
        {nodeLetter && <span className="cm-tag node-tag">node {nodeLetter}</span>}
        {hasDraft && (
          <span className="cm-tag draft-tag">edge draft: {edgeDraft.letter}→</span>
        )}
      </div>

      {/* Edge section */}
      <div className="cm-group cm-edge">
        <div className="cm-label">Edge</div>
        {!hasDraft && (
          <button className="cm-action" onClick={onStartEdge}>
            <span className="cm-action-ico">↗</span>
            Start edge from here
            <span className="cm-action-sub">tags this cell as a node</span>
          </button>
        )}
        {hasDraft && (
          <div className="cm-finish">
            <div className="cm-finish-hint">
              Finish edge <b>{edgeDraft.letter} → here</b> · pick op:
            </div>
            <div className="cm-finish-ops">
              {['-', '->', '<-', '<->', '~', '~>', '<~', '<~>', '-|>', '|->'].map((op) => (
                <button key={op} className="cm-op-btn" onClick={() => onFinishEdge(op)}
                  title={`Finish with ${op}`}>{op}</button>
              ))}
            </div>
            <button className="cm-cancel" onClick={onCancelEdgeDraft}>Cancel draft</button>
          </div>
        )}
      </div>

      {/* Node section */}
      <div className="cm-group">
        <div className="cm-label">Node label</div>
        <div className="cm-node-row">
          <input className="cm-node-input" maxLength={1} value={nodeInput}
            placeholder="letter"
            onChange={(e) => setNodeInput(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1))}
            onKeyDown={(e) => { if (e.key === 'Enter') onSetNode(nodeInput); }} />
          <button className="cm-btn" onClick={() => onSetNode(nodeInput)} disabled={!nodeInput && !nodeLetter}>
            {nodeInput ? 'Set' : 'Clear'}
          </button>
          {nodeLetter && (
            <button className="cm-btn ghost" onClick={() => onSetNode('')} title="Remove this node">Clear</button>
          )}
        </div>
      </div>

      {/* Bus label (only for bus cells) */}
      {isBus && (
        <div className="cm-group">
          <div className="cm-label">Bus value</div>
          <div className="cm-bus-row">
            <input className="cm-bus-input" value={busInput}
              placeholder="bus label"
              onChange={(e) => setBusInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSetBusLabel(busInput); }} />
            <button className="cm-btn" onClick={() => onSetBusLabel(busInput)}>Set</button>
          </div>
        </div>
      )}

      {/* Char palette */}
      {CYCLE_MENU_GROUPS.map((g) => (
        <div className="cm-group" key={g.label}>
          <div className="cm-label">{g.label}</div>
          <div className="cm-row">
            {g.items.map((it) => (
              <button key={it.ch}
                className={'cm-item' + (it.ch === current ? ' active' : '') + ' cm-bus-' + it.ch}
                onClick={() => onPick(it.ch)}
                title={it.desc}>
                <span className="cm-ch">{it.ch}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export {
  Toolbar, Workarea, Drawer, Inspector, SampleModal, DocPanel, CycleMenu,
};
