// barchart.js — a small SVG column chart: one series, optional sign (bars grow
// up or down from a zero baseline), per-bar tooltip on hover and tap.
//
// Marks follow the app's chart rules: columns at most 24px wide with a 4px
// rounded data end (square at the baseline), a recessive grid, text in text
// colours (never the series colour), one axis.

const NS = 'http://www.w3.org/2000/svg';
const POS = '#3987e5';   // blue: magnitude, or "in your favour"
const NEG = '#e66767';   // red: against you
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// A column with a rounded data end; y0 is the baseline, y1 the data end.
function columnPath(x, w, y0, y1) {
  const r = Math.min(4, Math.abs(y1 - y0), w / 2);
  if (y1 < y0) { // grows up
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

function niceStep(range, target = 4) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

// data: [{ x: label, y: number, tip: string }]
// opts: { width, height, signed, yFmt(v), xTitle, ariaLabel }
export function columnChart(data, opts = {}) {
  const width = Math.max(300, Math.floor(opts.width || 600));
  const height = opts.height || 200;
  const m = { top: 12, right: 8, bottom: opts.xTitle ? 38 : 24, left: 44 };
  const pw = width - m.left - m.right;
  const ph = height - m.top - m.bottom;
  const ys = data.map((d) => d.y);
  let lo = opts.signed ? Math.min(0, ...ys) : 0;
  let hi = Math.max(0, ...ys);
  if (hi === lo) hi = lo + 1;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const yOf = (v) => m.top + ph - ((v - lo) / (hi - lo)) * ph;
  const band = pw / data.length;
  const barW = Math.max(3, Math.min(24, band - 2, band * 0.72));

  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': opts.ariaLabel || 'chart' });
  svg.style.maxWidth = '100%';
  svg.style.display = 'block';

  // grid + y labels
  for (let v = lo; v <= hi + step / 2; v += step) {
    const y = yOf(v);
    svg.append(svgEl('line', { x1: m.left, x2: width - m.right, y1: y, y2: y, stroke: Math.abs(v) < 1e-12 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.08)', 'stroke-width': 1 }));
    const t = svgEl('text', { x: m.left - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#9db3a6' });
    t.textContent = opts.yFmt ? opts.yFmt(v) : String(v);
    svg.append(t);
  }

  const tip = document.createElement('div');
  Object.assign(tip.style, {
    position: 'absolute', pointerEvents: 'none', background: '#1a3529', border: '1px solid #2a4a3b', borderRadius: '8px',
    padding: '6px 9px', fontSize: '13px', color: '#eef4ef', whiteSpace: 'nowrap', display: 'none', zIndex: 2,
    boxShadow: '0 4px 12px rgba(0,0,0,.4)',
  });

  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(pw / 26)));
  data.forEach((d, i) => {
    const cx = m.left + band * i + band / 2;
    const y0 = yOf(0);
    const y1 = yOf(d.y);
    const color = opts.signed && d.y < 0 ? NEG : POS;
    if (Math.abs(y1 - y0) >= 0.5) svg.append(svgEl('path', { d: columnPath(cx - barW / 2, barW, y0, y1), fill: color }));
    if (i % labelEvery === 0) {
      const t = svgEl('text', { x: cx, y: height - m.bottom + 16, 'text-anchor': 'middle', 'font-size': 11, fill: '#9db3a6' });
      t.textContent = d.x;
      svg.append(t);
    }
    // the hit target is the whole band, taller and wider than the mark
    const hit = svgEl('rect', { x: m.left + band * i, y: m.top, width: band, height: ph, fill: 'transparent', tabindex: 0 });
    const show = () => {
      tip.textContent = d.tip;
      tip.style.display = 'block';
      const left = Math.min(Math.max(0, cx - tip.offsetWidth / 2), width - tip.offsetWidth);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(0, Math.min(y0, y1) - 34)}px`;
    };
    const hide = () => { tip.style.display = 'none'; };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
    hit.addEventListener('click', show);
    svg.append(hit);
  });
  if (opts.xTitle) {
    const t = svgEl('text', { x: m.left + pw / 2, y: height - 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#6f8a7b' });
    t.textContent = opts.xTitle;
    svg.append(t);
  }
  wrap.append(svg, tip);
  return wrap;
}
