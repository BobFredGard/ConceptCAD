// Un petit DOM, vrai mais sans écran : les fiches FAO de la page se construisent dedans, sans une ligne
// changée, et le programme natif dessine ce qu'elles ont construit. Les gestionnaires restent ici :
// le programme renvoie seulement « tel élément a été cliqué » ou « a changé ».
'use strict';
class Liste {
  constructor(el) { this.el = el; this.s = new Set(); }
  charger(t) { this.s = new Set(String(t || '').split(/\s+/).filter(Boolean)); }
  add(...a) { a.forEach(x => this.s.add(x)); this.el._cn = [...this.s].join(' '); }
  remove(...a) { a.forEach(x => this.s.delete(x)); this.el._cn = [...this.s].join(' '); }
  toggle(x, f) { const o = f === undefined ? !this.s.has(x) : !!f; if (o) this.add(x); else this.remove(x); return o; }
  contains(x) { return this.s.has(x); }
}
let compteur = 0;
const ELEMENTS = new Map();
class Noeud {
  constructor(tag, type) {
    this.nodeType = type;
    this.tagName = tag;
    this.nodeName = tag;
    this.parentNode = null;
    this.childNodes = [];
    this._txt = '';
    this.ownerDocument = null;
  }
  get parentElement() { return this.parentNode; }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get childElementCount() { return this.children.length; }
  _frere(d) { if (!this.parentNode) return null; const L = this.parentNode.childNodes; return L[L.indexOf(this) + d] || null; }
  get nextSibling() { return this._frere(1); }
  get previousSibling() { return this._frere(-1); }
  get nextElementSibling() { let n = this.nextSibling; while (n && n.nodeType !== 1) n = n.nextSibling; return n; }
  get previousElementSibling() { let n = this.previousSibling; while (n && n.nodeType !== 1) n = n.previousSibling; return n; }
  appendChild(c) { return this.insertBefore(c, null); }
  insertBefore(c, ref) {
    if (!c) return c;
    if (c.nodeType === 11) { [...c.childNodes].forEach(x => this.insertBefore(x, ref)); return c; }
    if (c.parentNode) c.parentNode.removeChild(c);
    const L = this.childNodes, i = ref ? L.indexOf(ref) : -1;
    if (i >= 0) L.splice(i, 0, c); else L.push(c);
    c.parentNode = this;
    return c;
  }
  append(...a) { a.forEach(x => this.appendChild(typeof x === 'string' ? new Noeud('#text', 3).avec(x) : x)); }
  prepend(...a) { const r = this.firstChild; a.forEach(x => this.insertBefore(typeof x === 'string' ? new Noeud('#text', 3).avec(x) : x, r)); }
  avec(t) { this._txt = String(t); return this; }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); if (c) c.parentNode = null; return c; }
  replaceChild(n, o) { this.insertBefore(n, o); this.removeChild(o); return o; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(o) { for (let n = o; n; n = n.parentNode) if (n === this) return true; return false; }
  get textContent() { return this.nodeType === 3 ? this._txt : this.childNodes.map(c => c.textContent).join(''); }
  set textContent(t) {
    if (this.nodeType === 3) { this._txt = String(t); return; }
    this.childNodes.forEach(c => { c.parentNode = null; });
    this.childNodes = [];
    if (t !== '' && t !== null && t !== undefined) this.appendChild(new Noeud('#text', 3).avec(t));
  }
  get nodeValue() { return this._txt; }
  set nodeValue(t) { this._txt = String(t); }
}
class Element extends Noeud {
  constructor(tag) {
    super(String(tag).toUpperCase(), 1);
    this.n = ++compteur;
    ELEMENTS.set(this.n, this);
    this._cn = '';
    this._cl = new Liste(this);
    this._at = {};
    this._ev = {};
    this.style = { cssText: '', setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; }, getPropertyValue(k) { return this[k] || ''; } };
    this.dataset = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.title = '';
    this.id = '';
    this.type = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.offsetWidth = 240;
    this.offsetHeight = 20;
    this.clientWidth = 800;
    this.clientHeight = 500;
    this.scrollHeight = 0;
    this.scrollWidth = 0;
  }
  get className() { return this._cn; }
  set className(t) { this._cn = String(t); this._cl.charger(t); }
  get classList() { this._cl.charger(this._cn); return this._cl; }
  get innerHTML() { return this.textContent; }
  set innerHTML(t) {
    // Les rares fiches qui écrivent du HTML : on garde le texte, sans les balises
    const brut = String(t || '');
    this.textContent = brut.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }
  get innerText() { return this.textContent; }
  set innerText(t) { this.textContent = t; }
  setAttribute(k, v) { this._at[k] = String(v); if (k === 'class') this.className = v; else if (k === 'id') this.id = String(v); else if (k === 'title' || k === 'type' || k === 'value') this[k] = String(v); }
  getAttribute(k) { return k in this._at ? this._at[k] : (k === 'class' ? this._cn : null); }
  hasAttribute(k) { return k in this._at; }
  removeAttribute(k) { delete this._at[k]; }
  addEventListener(t, f) { if (typeof f === 'function') (this._ev[t] = this._ev[t] || []).push(f); }
  removeEventListener(t, f) { const L = this._ev[t]; if (L) { const i = L.indexOf(f); if (i >= 0) L.splice(i, 1); } }
  dispatchEvent(e) {
    e.target = e.target || this;
    for (let n = this; n; n = n.parentNode) {
      if (n.nodeType !== 1) continue;
      e.currentTarget = n;
      n._lancer(e);
      if (e._arret || !e.bubbles) break;
    }
    return !e.defaultPrevented;
  }
  _lancer(e) {
    const h = this['on' + e.type];
    if (typeof h === 'function') h.call(this, e);
    (this._ev[e.type] || []).slice().forEach(f => f.call(this, e));
  }
  click() { this.dispatchEvent(evenement('click')); }
  focus() {} blur() {} select() {} scrollIntoView() {} setPointerCapture() {} releasePointerCapture() {} setCapture() {} releaseCapture() {} setSelectionRange() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 240, bottom: 20, width: 240, height: 20, x: 0, y: 0 }; }
  getContext() { return Element.ctx2d; }
  cloneNode(prof) {
    const c = new Element(this.tagName);
    c.className = this._cn; c.value = this.value; c.title = this.title; c.type = this.type; c.checked = this.checked;
    Object.assign(c.dataset, this.dataset);
    if (prof) this.childNodes.forEach(x => c.appendChild(x.nodeType === 3 ? new Noeud('#text', 3).avec(x._txt) : x.cloneNode(true)));
    else if (this.childNodes.length && this.childNodes.every(x => x.nodeType === 3)) c.textContent = this.textContent;
    return c;
  }
  _correspond(sel) {
    return sel.split(',').some(p => unChemin(this, p.trim().split(/\s*>\s*|\s+/)));
  }
  matches(sel) { return this._correspond(sel); }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n._correspond(sel)) return n; return null; }
  querySelectorAll(sel) {
    const r = [];
    const voir = e => e.children.forEach(c => { if (c._correspond(sel)) r.push(c); voir(c); });
    voir(this);
    return r;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  get options() { return this.querySelectorAll('option'); }
  get selectedIndex() { return this.options.findIndex(o => o.value === this.value); }
  set selectedIndex(i) { const o = this.options[i]; if (o) this.value = o.value; }
  get rows() { return this.children; }
}
function simple(e, s) {
  const m = s.match(/^([a-zA-Z0-9*]*)((?:[.#\[][^.#\[]+)*)$/);
  if (!m) return false;
  if (m[1] && m[1] !== '*' && e.tagName !== m[1].toUpperCase()) return false;
  for (const q of (m[2].match(/[.#\[][^.#\[]+/g) || [])) {
    if (q[0] === '.' && !e.classList.contains(q.slice(1))) return false;
    if (q[0] === '#' && e.id !== q.slice(1)) return false;
    if (q[0] === '[') {
      const a = q.slice(1, -1).split('='), k = a[0], v = a[1] && a[1].replace(/^["']|["']$/g, '');
      const lu = k === 'type' ? e.type : k.startsWith('data-') ? e.dataset[k.slice(5).replace(/-(.)/g, (x, y) => y.toUpperCase())] : e.getAttribute(k);
      if (v === undefined ? lu === null || lu === undefined : String(lu) !== v) return false;
    }
  }
  return true;
}
function unChemin(e, P) {
  if (!simple(e, P[P.length - 1])) return false;
  let i = P.length - 2;
  for (let n = e.parentNode; i >= 0 && n && n.nodeType === 1; n = n.parentNode) if (simple(n, P[i])) i--;
  return i < 0;
}
function evenement(type, init) {
  const e = Object.assign({ type, bubbles: true, cancelable: true, defaultPrevented: false, target: null, currentTarget: null, _arret: false, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, button: 0, clientX: 0, clientY: 0, key: '' }, init || {});
  e.stopPropagation = () => { e._arret = true; };
  e.stopImmediatePropagation = () => { e._arret = true; };
  e.preventDefault = () => { e.defaultPrevented = true; };
  return e;
}
// Ce que le programme natif sait dessiner d'un élément
function decrire(e) {
  if (e.nodeType === 3) return e._txt.trim() ? { t: '#', x: e._txt } : null;
  if (e.style.display === 'none') return null;
  const o = { n: e.n, t: e.tagName };
  if (e._cn) o.c = e._cn;
  if (e.title) o.ti = e.title;
  if (e.disabled) o.off = true;
  if (e.style.opacity) o.op = e.style.opacity;
  if (e.style.color) o.co = e.style.color;
  if (e.style.background || e.style.backgroundColor) o.fd = e.style.background || e.style.backgroundColor;
  if (e.style.fontWeight) o.gr = String(e.style.fontWeight);
  if (e.tagName === 'INPUT') { o.ty = e.type || 'text'; if (o.ty === 'checkbox' || o.ty === 'radio') o.ck = !!e.checked; else o.v = String(e.value); }
  if (e.tagName === 'TEXTAREA') o.v = String(e.value);
  if (e.tagName === 'SELECT') { o.v = String(e.value); o.opts = e.options.map(x => [String(x.value), x.textContent]); return o; }
  if (e._ev.click || e.onclick) o.ck_ = true;
  const L = e.childNodes.map(decrire).filter(Boolean);
  if (L.length === 1 && L[0].t === '#') o.x = L[0].x;
  else if (L.length) o.ch = L;
  return o;
}
// Le programme natif a touché l'élément n
function toucher(n, sorte, valeur, mods) {
  const e = ELEMENTS.get(n);
  if (!e) return false;
  if (sorte === 'change' || sorte === 'input') {
    if (e.tagName === 'INPUT' && (e.type === 'checkbox' || e.type === 'radio')) e.checked = !!valeur;
    else e.value = String(valeur);
    e.dispatchEvent(evenement('input', mods));
    e.dispatchEvent(evenement('change', mods));
  } else e.dispatchEvent(evenement(sorte, mods));
  return true;
}
// Les anciens éléments ne servent plus : on les oublie, sauf ceux qui sont encore dans l'une des racines
function oublier(racines) {
  const garde = new Set();
  const voir = e => { garde.add(e.n); e.children.forEach(voir); };
  racines.forEach(voir);
  for (const k of ELEMENTS.keys()) if (!garde.has(k)) ELEMENTS.delete(k);
}
module.exports = { Element, Noeud, evenement, decrire, toucher, oublier };
