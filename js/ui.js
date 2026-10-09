// ui.js — tiny DOM helpers. No framework: views build elements with el().

// Views write optional children as `cond ? node : null` and pass arrays from
// .map(). el() handles both, but the native append/prepend/replaceChildren would
// print "null" or "[object HTMLElement]". Make the native ones behave like el():
// flatten arrays, skip null / undefined / false. Applied once, app-wide.
if (typeof Element !== 'undefined' && !Element.prototype.__ssPatched) {
  for (const proto of [Element.prototype, DocumentFragment.prototype]) {
    for (const name of ['append', 'prepend', 'replaceChildren']) {
      const native = proto[name];
      proto[name] = function patched(...kids) {
        return native.apply(this, kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
      };
    }
  }
  Element.prototype.__ssPatched = true;
}

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else if (c instanceof Node) node.append(c);
    else node.append(document.createTextNode(String(c)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ESC[c]); }

// The lesson markdown subset: **bold**, *italic*, `code`. Everything else is text.
export function mdInline(src) {
  let s = escapeHtml(src ?? '');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

export function md(tag, src, attrs = {}) {
  return el(tag, { ...attrs, html: mdInline(src) });
}

let toastTimer = null;
export function toast(msg, ms = 2400) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// A modal dialog. Returns { close }. `build(close)` returns the content node.
export function modal(build) {
  const back = el('div', { class: 'modal-back' });
  const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  box.append(build(close));
  back.append(box);
  document.body.append(back);
  return { close };
}

export function fmtPct(x, digits = 2) {
  const s = (Math.abs(x)).toFixed(digits);
  return `${x < 0 ? '−' : ''}${s}%`;
}

export function fmtSigned(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

export function fmtMs(ms) {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

// A signed number pad. onSubmit(value:number). Returns { node, reset, setDisabled }.
// Supports keyboard: digits, '-', Backspace, Enter.
export function numberPad({ onSubmit, allowNegative = true, allowHalf = false, placeholder = '?' }) {
  let text = '';
  const entry = el('div', { class: 'entry num', 'aria-live': 'polite' }, placeholder);
  const render = () => { entry.textContent = text === '' ? placeholder : text.replace('-', '−'); };
  const press = (k) => {
    if (disabled) return;
    if (k === 'del') text = text.slice(0, -1);
    else if (k === '±') { if (allowNegative) text = text.startsWith('-') ? text.slice(1) : '-' + text; }
    else if (k === '.') { if (allowHalf && !text.includes('.')) text += (text === '' || text === '-' ? '0' : '') + '.5'; }
    else if (k === 'ok') {
      const v = Number(text);
      if (text === '' || text === '-' || Number.isNaN(v)) return;
      onSubmit(v);
      return;
    } else if (text.replace('-', '').length < 4 && !text.includes('.')) text += k;
    render();
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowNegative ? '±' : (allowHalf ? '.' : ''), '0', 'del'];
  const pad = el('div', { class: 'numpad' },
    keys.map((k) => k === '' ? el('span') : el('button', { type: 'button', onclick: () => press(k), 'aria-label': k === 'del' ? 'Delete' : k === '±' ? 'Plus or minus' : k }, k === 'del' ? '⌫' : k === '±' ? '+/−' : k)),
    allowHalf && allowNegative ? el('button', { type: 'button', class: 'wide', onclick: () => press('.') }, '+ ½') : null,
    el('button', { type: 'button', class: 'wide go', onclick: () => press('ok') }, 'Enter'),
  );
  let disabled = false;
  const onKey = (e) => {
    if (!node.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === '-' || e.key === '+') press('±');
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') { e.preventDefault(); press('ok'); }
    else if (e.key === '.' && allowHalf) press('.');
  };
  document.addEventListener('keydown', onKey);
  const node = el('div', {}, entry, pad);
  return {
    node,
    reset() { text = ''; render(); },
    setDisabled(d) { disabled = d; pad.querySelectorAll('button').forEach((b) => { b.disabled = d; }); },
  };
}

export function progressBar(frac, cls = '') {
  return el('div', { class: `bar ${cls}` }, el('span', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` } }));
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
