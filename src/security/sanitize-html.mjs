import xss from 'xss';
import { packageUrl, packageCssUrls } from './package-url.mjs';

const globals = ['id', 'class', 'title', 'style', 'role', 'hidden', 'tabindex'];
const tags = ['a', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'canvas',
  'caption', 'cite', 'code', 'dd', 'details', 'div', 'dl', 'dt', 'em', 'figcaption',
  'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img',
  'input', 'label', 'li', 'main', 'nav', 'ol', 'option', 'p', 'pre', 'section',
  'dialog', 'form', 'fieldset', 'legend', 'output', 'progress', 'meter',
  'select', 'small', 'span', 'strong', 'summary', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'ul', 'svg', 'polygon', 'polyline', 'line', 'path', 'circle', 'text',
  'g', 'rect', 'ellipse', 'defs', 'lineargradient', 'radialgradient', 'stop'];
const extras = {
  a: ['href', 'target', 'rel'], button: ['type', 'disabled'],
  canvas: ['width', 'height'], img: ['src', 'alt', 'width', 'height', 'draggable', 'loading'],
  input: ['type', 'value', 'min', 'max', 'step', 'checked', 'disabled', 'name'],
  label: ['for'], select: ['name', 'disabled'], option: ['value', 'selected', 'disabled'],
  details: ['open'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
  dialog: ['open'], form: ['name'], output: ['for', 'name'],
  progress: ['value', 'max'], meter: ['value', 'min', 'max'],
  svg: ['viewbox', 'width', 'height'], polygon: ['points', 'fill', 'stroke', 'stroke-width'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width'],
  line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width'],
  path: ['d', 'fill', 'stroke', 'stroke-width'], circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
  text: ['x', 'y', 'fill', 'font-size', 'text-anchor', 'dominant-baseline'],
  g: ['transform', 'fill', 'stroke'], rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  lineargradient: ['x1', 'x2', 'y1', 'y2'], radialgradient: ['cx', 'cy', 'r'],
  stop: ['offset', 'stop-color', 'stop-opacity'],
};
const whiteList = Object.fromEntries(tags.map(tag => [tag, [...globals, ...(extras[tag] ?? [])]]));
const raster = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i;

function safeUrl(raw, image = false) {
  const value = xss.friendlyAttrValue(String(raw)).trim();
  if (/[\u0000-\u0020\u007f-\u009f\\]/u.test(value) || value.startsWith('//')) return '';
  if (image && raster.test(value)) return value;
  if (/^[^/?#]*:/.test(value) && !/^https:\/\//i.test(value)) return '';
  if (/^https:\/\//i.test(value)) {
    try { const u = new URL(value); if (u.username || u.password) return ''; }
    catch { return ''; }
  }
  return packageUrl(value);
}

const filter = new xss.FilterXSS({
  whiteList, stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'template', 'math', 'foreignobject'],
  onIgnoreTagAttr(tag, name, value) {
    if (whiteList[tag] && /^(?:data-[a-z0-9-]+|aria-[a-z0-9-]+)$/.test(name))
      return `${name}="${xss.escapeAttrValue(value)}"`;
  },
  safeAttrValue(tag, name, value, cssFilter) {
    if (name === 'src' || name === 'href')
      return xss.escapeAttrValue(safeUrl(value, tag === 'img' && name === 'src'));
    if (['fill', 'stroke'].includes(name) && /url\s*\(|[\\<>]/i.test(value)) return '';
    return xss.safeAttrValue(tag, name, value, cssFilter);
  },
  css: {
    whiteList: {
      ...xss.getDefaultCSSWhiteList(), display: true, gap: true, 'grid-template-columns': true,
      'align-items': true, 'justify-content': true, 'flex-direction': true,
      'flex-wrap': true, 'object-fit': true, 'aspect-ratio': true, transform: true,
      'transform-origin': true, 'pointer-events': true, position: true, top: true,
      left: true, right: true, bottom: true, 'z-index': true, opacity: true,
      flex: true, 'flex-grow': true, 'flex-shrink': true, 'flex-basis': true,
      'align-self': true,
    },
    safeAttrValue(name, value) {
      // CSS escapes/comments are unnecessary for authored game styles and hide URL schemes.
      if (/[\\<>@]|\/\*/.test(value) || /expression\s*\(|(?:java|vb)script\s*:|behavior|-moz-binding/i.test(value)) return '';
      let safe = true;
      value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_, q, url) => {
        if (!safeUrl(url, true)) safe = false;
        return _;
      });
      return safe ? packageCssUrls(value) : '';
    },
  },
});

/** All browser HTML sinks use the same real allowlist, including the offline build. */
export function sanitizeHtml(value) {
  return filter.process(String(value ?? ''));
}
