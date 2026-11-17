/** Resolve old site-root asset identifiers inside the current static package. */
export function packageUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return value;
  const base = globalThis.document?.baseURI;
  if (!base) return value;
  const url = new URL(value.slice(1), new URL('.', base));
  return url.protocol === 'file:' ? url.href : url.pathname + url.search + url.hash;
}

export function packageCssUrls(value) {
  return value.replace(/url\(\s*(["']?)(\/[^)'"\s]*)\1\s*\)/gi,
    (_, quote, url) => `url(${quote}${packageUrl(url)}${quote})`);
}
