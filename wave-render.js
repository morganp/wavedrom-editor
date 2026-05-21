// wave-render.js — pure helpers for waveform parsing and SVG path generation.
  // ── characters ────────────────────────────────────────────────
  // Treat 'l/h/L/H' as 0/1 with optional arrows (we draw without arrows for clarity).
  // 'p/P/n/N' are clocks. 'x' is don't-care, 'z' is hi-Z.
  // '=' and '2'-'5' are bus values, label from data[].
  // '|' is a gap (rendered as zigzag overlay).
  // '.' means "extend previous".

  const CLOCK = new Set(['p', 'P', 'n', 'N']);
  const LOGIC = new Set(['0', '1', 'l', 'h', 'L', 'H']);
  const BUS   = new Set(['=', '2', '3', '4', '5']);
  const SPECIAL = new Set(['x', 'z']);
  const GAP   = '|';

  function isWaveChar(c) {
    return CLOCK.has(c) || LOGIC.has(c) || BUS.has(c) || SPECIAL.has(c) || c === GAP || c === '.';
  }

  function logicLevel(c) {
    if (c === '0' || c === 'l' || c === 'L') return 'lo';
    if (c === '1' || c === 'h' || c === 'H') return 'hi';
    return null;
  }

  // Parse wave string into segments. Each segment = { ch, start, len } where start/len
  // are in *char positions* (1 char = 1 cycle in source). Period scales width at render.
  function parseWave(wave) {
    const segs = [];
    if (!wave) return segs;
    let cur = null;
    for (let i = 0; i < wave.length; i++) {
      const c = wave[i];
      if (c === '.') {
        if (cur) cur.len++;
        else segs.push(cur = { ch: '0', start: i, len: 1, implicit: true });
      } else if (c === '|') {
        // Gap stays attached to current segment but is drawn as overlay at this index.
        if (cur) {
          cur.gaps = (cur.gaps || []);
          cur.gaps.push(i);
          cur.len++;
        } else {
          segs.push(cur = { ch: '0', start: i, len: 1, implicit: true, gaps: [i] });
        }
      } else if (isWaveChar(c)) {
        cur = { ch: c, start: i, len: 1 };
        segs.push(cur);
      } else {
        // unknown; treat like '.'
        if (cur) cur.len++;
      }
    }
    return segs;
  }

  function busFill(ch) {
    return ({
      '=': 'var(--bus-eq)',
      '2': 'var(--bus-2)',
      '3': 'var(--bus-3)',
      '4': 'var(--bus-4)',
      '5': 'var(--bus-5)',
    })[ch] || 'var(--bus-eq)';
  }

  // Render an array of segments to SVG children-string.
  // opts: { cw (cycle width px), period, h (height), pad (vertical pad), phase, dataLabels }
  // Returns { paths: [...JSX], width: totalPx, transitions: [{x, segIndex, fromCh, toCh}] }
  function renderWave(segs, opts) {
    const { cw, period = 1, h, pad = 6, phase = 0, dataLabels = [] } = opts;
    const yHi = pad;
    const yLo = h - pad;
    const yMid = (yHi + yLo) / 2;
    const slew = Math.min(4, cw * period * 0.18); // slope width for transitions
    const offset = -phase * cw; // negative phase shifts content right; wavedrom uses phase to shift left when positive

    const els = [];
    const transitions = [];
    let dataIdx = 0;

    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      const x0 = offset + seg.start * cw * period;
      const x1 = x0 + seg.len * cw * period;
      const ch = seg.ch;
      const prev = s > 0 ? segs[s - 1] : null;
      const prevCh = prev ? prev.ch : null;

      // transition line at x0 between prev and this seg
      if (prev && !seg.implicit) {
        // store transition handle for drag
        transitions.push({ x: x0, segIndex: s, fromCh: prevCh, toCh: ch, charIndex: seg.start });

        // Draw transition shape at boundary
        drawTransition(els, x0, slew, yHi, yLo, yMid, prevCh, ch);
      }

      if (CLOCK.has(ch)) {
        // Clock: each *cycle* (cw px) toggles.
        // p/P start with rising edge in middle; in wavedrom, 'p' is positive clock:
        // draws rising edge at the START of each cycle for the first cycle, then continues.
        // Simplification: 'p'/'P' = low/2 then high/2 per cycle starting low; 'n'/'N' inverse.
        const startLow = (ch === 'p' || ch === 'P');
        const cycles = Math.round(seg.len / 1); // each char in segment = 1 clock cycle (period scales)
        for (let i = 0; i < seg.len; i++) {
          const cx0 = x0 + i * cw * period;
          const cmid = cx0 + cw * period / 2;
          const cx1 = cx0 + cw * period;
          // first half low (or high), second half high (or low)
          if (startLow) {
            els.push(['line', { x1: cx0, y1: yLo, x2: cmid, y2: yLo, key: 'cl-'+s+'-'+i+'a' }]);
            els.push(['line', { x1: cmid, y1: yLo, x2: cmid, y2: yHi, key: 'cl-'+s+'-'+i+'b' }]);
            els.push(['line', { x1: cmid, y1: yHi, x2: cx1, y2: yHi, key: 'cl-'+s+'-'+i+'c' }]);
            els.push(['line', { x1: cx1, y1: yHi, x2: cx1, y2: yLo, key: 'cl-'+s+'-'+i+'d' }]);
          } else {
            els.push(['line', { x1: cx0, y1: yHi, x2: cmid, y2: yHi, key: 'cl-'+s+'-'+i+'a' }]);
            els.push(['line', { x1: cmid, y1: yHi, x2: cmid, y2: yLo, key: 'cl-'+s+'-'+i+'b' }]);
            els.push(['line', { x1: cmid, y1: yLo, x2: cx1, y2: yLo, key: 'cl-'+s+'-'+i+'c' }]);
            els.push(['line', { x1: cx1, y1: yLo, x2: cx1, y2: yHi, key: 'cl-'+s+'-'+i+'d' }]);
          }
          // arrow markers for capital P/N
          if (ch === 'P' || ch === 'N') {
            const arrowY = startLow ? yHi : yLo;
            els.push(['polygon', {
              points: `${cmid},${arrowY} ${cmid-3},${arrowY + (startLow ? 5 : -5)} ${cmid+3},${arrowY + (startLow ? 5 : -5)}`,
              fill: 'currentColor',
              key: 'ar-'+s+'-'+i,
            }]);
          }
        }
      } else if (LOGIC.has(ch)) {
        const lvl = logicLevel(ch);
        const y = lvl === 'hi' ? yHi : yLo;
        els.push(['line', { x1: x0 + (s>0 && !seg.implicit ? slew : 0), y1: y, x2: x1, y2: y, key: 'lg-'+s }]);
      } else if (BUS.has(ch)) {
        const fill = busFill(ch);
        // hexagon-like bus shape: slanted ends connect to neighboring segments
        const lx = x0 + (s>0 && !seg.implicit ? slew : 0);
        const rx = x1; // right side closes via next transition
        els.push(['polygon', {
          points: `${lx},${yHi} ${rx},${yHi} ${rx},${yLo} ${lx},${yLo}`,
          fill, stroke: 'currentColor', strokeWidth: 1,
          key: 'bus-'+s,
        }]);
        // label
        const label = dataLabels[dataIdx] != null ? String(dataLabels[dataIdx]) : '';
        if (label) {
          els.push(['text', {
            x: (lx + rx) / 2, y: yMid + 3.5,
            textAnchor: 'middle',
            fontSize: 11,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fill: 'currentColor',
            key: 'tx-'+s,
            style: { pointerEvents: 'none' },
          }, label]);
        }
        dataIdx++;
      } else if (ch === 'x') {
        const lx = x0 + (s>0 && !seg.implicit ? slew : 0);
        els.push(['polygon', {
          points: `${lx},${yHi} ${x1},${yHi} ${x1},${yLo} ${lx},${yLo}`,
          fill: 'url(#hatch)', stroke: 'currentColor', strokeWidth: 1,
          key: 'x-'+s,
        }]);
      } else if (ch === 'z') {
        els.push(['line', { x1: x0, y1: yMid, x2: x1, y2: yMid,
          stroke: 'currentColor', strokeDasharray: '0', key: 'z-'+s }]);
      }

      // gap overlay
      if (seg.gaps) {
        for (const gIdx of seg.gaps) {
          const gx = offset + gIdx * cw * period + cw * period / 2;
          els.push(['path', {
            d: `M ${gx-4} ${yLo+2} L ${gx-1} ${yHi-2} L ${gx+1} ${yLo+2} L ${gx+4} ${yHi-2}`,
            fill: 'none', stroke: 'var(--bg)', strokeWidth: 6,
            key: 'gp-bg-'+s+'-'+gIdx,
          }]);
          els.push(['path', {
            d: `M ${gx-4} ${yLo+2} L ${gx-1} ${yHi-2} L ${gx+1} ${yLo+2} L ${gx+4} ${yHi-2}`,
            fill: 'none', stroke: 'var(--ink-3)', strokeWidth: 1,
            key: 'gp-'+s+'-'+gIdx,
          }]);
        }
      }
    }

    return { els, transitions };
  }

  function drawTransition(els, x, slew, yHi, yLo, yMid, prevCh, ch) {
    // Build slanted edge between prev and current segment.
    const prevLvl = logicLevel(prevCh);
    const curLvl  = logicLevel(ch);
    if (prevLvl && curLvl) {
      const y0 = prevLvl === 'hi' ? yHi : yLo;
      const y1 = curLvl  === 'hi' ? yHi : yLo;
      els.push(['line', { x1: x, y1: y0, x2: x + slew, y2: y1, key: 't-l-'+x }]);
    } else if (BUS.has(ch) || ch === 'x') {
      // close prior with /\\
      els.push(['line', { x1: x, y1: yMid, x2: x + slew, y2: yHi, key: 't-bu-'+x }]);
      els.push(['line', { x1: x, y1: yMid, x2: x + slew, y2: yLo, key: 't-bd-'+x }]);
      if (prevCh && (BUS.has(prevCh) || prevCh === 'x')) {
        // connect prev bus' right wall via slanted close
        els.push(['line', { x1: x - slew, y1: yHi, x2: x, y2: yMid, key: 't-pbu-'+x }]);
        els.push(['line', { x1: x - slew, y1: yLo, x2: x, y2: yMid, key: 't-pbd-'+x }]);
      } else if (prevLvl) {
        const y0 = prevLvl === 'hi' ? yHi : yLo;
        els.push(['line', { x1: x - slew, y1: y0, x2: x, y2: yMid, key: 't-plv-'+x }]);
      }
    } else if (prevCh && (BUS.has(prevCh) || prevCh === 'x')) {
      // prev bus to logic: close bus with \/
      els.push(['line', { x1: x - slew, y1: yHi, x2: x, y2: yMid, key: 't-pbu2-'+x }]);
      els.push(['line', { x1: x - slew, y1: yLo, x2: x, y2: yMid, key: 't-pbd2-'+x }]);
      if (curLvl) {
        const y1 = curLvl === 'hi' ? yHi : yLo;
        els.push(['line', { x1: x, y1: yMid, x2: x + slew, y2: y1, key: 't-clv-'+x }]);
      }
    }
  }

  // total cycles in a wave string (chars count)
  function waveLength(wave) { return (wave || '').length; }

  // ── wave string mutation helpers ─────────────────────────────────
  // toggle the value at a cycle index — produce next char in cycle
  const TOGGLE_CYCLE = ['0', '1', 'l', 'h', 'p', 'n', 'x', 'z'];
  function setCharAt(wave, idx, ch) {
    const arr = wave.split('');
    arr[idx] = ch;
    return arr.join('');
  }
  function nextValue(ch) {
    const i = TOGGLE_CYCLE.indexOf(ch);
    if (i < 0) return '0';
    return TOGGLE_CYCLE[(i + 1) % TOGGLE_CYCLE.length];
  }

  // Move a transition that currently sits at charIndex (the "to" char) to a new char index.
  // Wave is a string. Snap to cycles already; caller passes int idx.
  // Returns { wave: newString, idx: actualLandingIndex } so callers can keep tracking
  // the transition across multiple drag updates.
  function moveTransition(wave, fromIdx, toIdx) {
    if (toIdx < 1 || toIdx >= wave.length) return { wave, idx: fromIdx };
    const ch = wave[fromIdx];
    if (!ch || ch === '.' || ch === '|') return { wave, idx: fromIdx };
    const arr = wave.split('');
    // Find left bound (after prev non-dot char).
    let left = fromIdx - 1;
    while (left > 0 && (arr[left] === '.' || arr[left] === '|')) left--;
    const leftBound = left + 1; // can't overlap prev segment's char position
    // Find right bound (before next non-dot char).
    let right = fromIdx + 1;
    while (right < arr.length && (arr[right] === '.' || arr[right] === '|')) right++;
    const rightBound = right - 1;
    const target = Math.max(leftBound, Math.min(rightBound, toIdx));
    if (target === fromIdx) return { wave, idx: fromIdx };
    arr[fromIdx] = '.';
    arr[target] = ch;
    return { wave: arr.join(''), idx: target };
  }

export {
  parseWave, renderWave, waveLength, setCharAt, nextValue,
  moveTransition, isWaveChar, logicLevel, CLOCK, LOGIC, BUS, SPECIAL,
  TOGGLE_CYCLE,
};
