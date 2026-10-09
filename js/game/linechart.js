// linechart.js — the session chart: your result vs what your play was worth,
// with the normal-luck band (±1 and ±2 standard deviations) around the latter.
//
// Chart rules (as barchart.js): one axis, 2px lines, a ~10% wash for the band,
// recessive grid, text in text colours, a legend plus direct end labels, and a
// crosshair + tooltip on hover and tap. Colours: the validated categorical
// slots 1 and 2 (blue, orange) checked against this app's surface.

const NS = 'http://www.w3.org/2000/svg';
export const ACTUAL = '#3987e5';
export const EXPECTED = '#d95926';
const TEXT = '#9db3a6';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

function niceStep(range, target = 4) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

const signed = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

// points: [{ round, actual, expected, sd }], starting at round 0.
// opts: { width, height, unitLabel: 'u', money: (units) => '$…' | null }
export function sessionChart(points, opts = {}) {
  const width = Math.max(300, Math.floor(opts.width || 600));
  const height = opts.height || 230;
  const m = { top: 24, right: 46, bottom: 34, left: 44 };
  const pw = width - m.left - m.right;
  const ph = height - m.top - m.bottom;
  const n = points.length - 1;

  let lo = 0, hi = 0;
  for (const p of points) {
    lo = Math.min(lo, p.actual, p.expected - 2 * p.sd);
    hi = Math.max(hi, p.actual, p.expected + 2 * p.sd);
  }
  if (hi - lo < 4) { hi += 2; lo -= 2; }
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const x = (r) => m.left + (n ? (r / n) * pw : 0);
  const y = (v) => m.top + ph - ((v - lo) / (hi - lo)) * ph;

  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': 'Your result each round compared with what your play was worth, with the normal range of luck' });
  svg.style.maxWidth = '100%';
  svg.style.display = 'block';

  // grid + y labels
  for (let v = lo; v <= hi + step / 2; v += step) {
    const zero = Math.abs(v) < 1e-9;
    svg.append(svgEl('line', { x1: m.left, x2: m.left + pw, y1: y(v), y2: y(v), stroke: zero ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)', 'stroke-width': 1 }));
    const t = svgEl('text', { x: m.left - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: TEXT });
    t.textContent = `${signed(v, 0)}`;
    svg.append(t);
  }
  // x labels: start, middle, end
  for (const r of [...new Set([0, Math.round(n / 2), n])]) {
    const t = svgEl('text', { x: x(r), y: height - m.bottom + 16, 'text-anchor': r === 0 ? 'start' : r === n ? 'end' : 'middle', 'font-size': 11, fill: TEXT });
    t.textContent = r === 0 ? 'start' : `round ${r}`;
    svg.append(t);
  }
  const ax = svgEl('text', { x: m.left - 6, y: 11, 'text-anchor': 'end', 'font-size': 10, fill: TEXT });
  ax.textContent = 'units';
  svg.append(ax);

  // luck bands around the expected line (±2 SD lighter, ±1 SD darker)
  const band = (k, opacity) => {
    const top = points.map((p) => `${x(p.round)},${y(p.expected + k * p.sd)}`);
    const bot = points.slice().reverse().map((p) => `${x(p.round)},${y(p.expected - k * p.sd)}`);
    svg.append(svgEl('polygon', { points: [...top, ...bot].join(' '), fill: EXPECTED, 'fill-opacity': opacity }));
  };
  band(2, 0.07);
  band(1, 0.12);

  const line = (key, color, dash) => svg.append(svgEl('polyline', {
    points: points.map((p) => `${x(p.round)},${y(p[key])}`).join(' '),
    fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...(dash ? { 'stroke-dasharray': '5 4' } : {}),
  }));
  line('expected', EXPECTED, true);
  line('actual', ACTUAL, false);

  // direct end labels (text in text colour; a colour dot carries identity)
  const last = points[points.length - 1];
  const labels = [
    { v: last.actual, color: ACTUAL, text: signed(last.actual) },
    { v: last.expected, color: EXPECTED, text: signed(last.expected) },
  ].sort((a, b) => y(a.v) - y(b.v));
  if (Math.abs(y(labels[0].v) - y(labels[1].v)) < 14) labels[1].dy = 14 - (y(labels[1].v) - y(labels[0].v));
  for (const l of labels) {
    const yy = y(l.v) + (l.dy || 0);
    svg.append(svgEl('circle', { cx: x(n) + 7, cy: yy, r: 3.5, fill: l.color }));
    const t = svgEl('text', { x: x(n) + 13, y: yy + 4, 'font-size': 11, fill: '#eef4ef', 'font-weight': 700 });
    t.textContent = l.text;
    svg.append(t);
  }

  // crosshair + tooltip
  const cross = svgEl('line', { y1: m.top, y2: m.top + ph, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1, visibility: 'hidden' });
  const dotA = svgEl('circle', { r: 4.5, fill: ACTUAL, stroke: '#132a20', 'stroke-width': 2, visibility: 'hidden' });
  const dotE = svgEl('circle', { r: 4.5, fill: EXPECTED, stroke: '#132a20', 'stroke-width': 2, visibility: 'hidden' });
  svg.append(cross, dotE, dotA);
  const tip = document.createElement('div');
  Object.assign(tip.style, {
    position: 'absolute', pointerEvents: 'none', background: '#1a3529', border: '1px solid #2a4a3b', borderRadius: '8px',
    padding: '6px 9px', fontSize: '12px', color: '#eef4ef', whiteSpace: 'nowrap', display: 'none', zIndex: 2, lineHeight: 1.45,
    boxShadow: '0 4px 12px rgba(0,0,0,.4)',
  });
  const hit = svgEl('rect', { x: m.left, y: m.top, width: pw, height: ph, fill: 'transparent' });
  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const scale = width / rect.width;
    const px = (evt.clientX - rect.left) * scale;
    const r = Math.max(0, Math.min(n, Math.round(((px - m.left) / pw) * n)));
    const p = points[r];
    const cx = x(r);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    dotA.setAttribute('cx', cx); dotA.setAttribute('cy', y(p.actual)); dotA.setAttribute('visibility', 'visible');
    dotE.setAttribute('cx', cx); dotE.setAttribute('cy', y(p.expected)); dotE.setAttribute('visibility', 'visible');
    const money = opts.money ? (v) => ` (${opts.money(v)})` : () => '';
    tip.innerHTML = '';
    const row = (color, label, v) => {
      const d = document.createElement('div');
      d.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${label} <b>${signed(v)}u</b>${money(v)}`;
      return d;
    };
    const head = document.createElement('div');
    head.style.color = TEXT;
    head.textContent = r === 0 ? 'Start' : `After round ${r}`;
    const range = document.createElement('div');
    range.style.color = TEXT;
    range.textContent = `Normal luck: ${signed(p.expected - p.sd)} to ${signed(p.expected + p.sd)}u`;
    tip.append(head, row(ACTUAL, 'You', p.actual), row(EXPECTED, 'Play worth', p.expected), range);
    tip.style.display = 'block';
    const left = (cx / scale) + 12 + tip.offsetWidth > rect.width ? (cx / scale) - tip.offsetWidth - 12 : (cx / scale) + 12;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${m.top / scale}px`;
  };
  const hide = () => { tip.style.display = 'none'; [cross, dotA, dotE].forEach((e) => e.setAttribute('visibility', 'hidden')); };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerdown', show);
  hit.addEventListener('pointerleave', hide);
  svg.append(hit);

  wrap.append(svg, tip);
  return wrap;
}

export function sessionLegend() {
  const item = (color, text, dashed) => {
    const s = document.createElement('span');
    s.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-right:14px';
    s.innerHTML = `<svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linecap="round"/></svg>${text}`;
    return s;
  };
  const band = document.createElement('span');
  band.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
  band.innerHTML = `<span style="display:inline-block;width:18px;height:10px;border-radius:2px;background:${EXPECTED};opacity:.25"></span>Normal luck`;
  const box = document.createElement('div');
  box.style.cssText = `display:flex;flex-wrap:wrap;gap:4px 0;font-size:13px;color:${TEXT};margin:4px 0 8px`;
  box.append(item(ACTUAL, 'Your result'), item(EXPECTED, 'What your play was worth', true), band);
  return box;
}
