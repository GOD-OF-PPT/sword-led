import {afterEach,describe,expect,it,vi} from 'vitest';
import {sanitizeHtml} from '../../src/security/sanitize-html.mjs';
import {packageUrl,packageCssUrls} from '../../src/security/package-url.mjs';

afterEach(()=>vi.unstubAllGlobals());

describe('HTML rendering trust boundary',()=>{
 it.each([
  '<img src="./missing" onerror="window.compromised=true">',
  '<svg onload="window.compromised=true"><foreignObject><iframe srcdoc="evil"></iframe></foreignObject></svg>',
  '<script>window.compromised=true</script><object data="evil"></object><embed src="evil">',
  '<a href="javascript&colon;alert(1)">bad</a>',
  '<a href="java&#x09;script:alert(1)">bad</a>',
  '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
  '<img src="data:text/html;base64,PHNjcmlwdD4=">',
  '<p style="background-image:url(data:image/svg+xml,evil);width:expression(alert(1))">bad</p>',
  '<p style="background-image:url(jav\\61script:alert(1))">bad</p>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
 ])('rejects executable tags, attributes and URL encodings: %s',html=>{
  const clean=sanitizeHtml(html);
  expect(clean).not.toMatch(/<\/?(?:script|iframe|object|embed|foreignobject|meta)\b|\bon(?:error|load)=|(?:java\s*script|expression)\s*[:(]|data:(?:image\/svg|text\/html)/i);
 });
 it('retains controls, raster art, style and the ending radar without an event bypass',()=>{
  const clean=sanitizeHtml('<button id="go" data-act="strike" aria-label="挥斩" disabled style="display:grid;grid-template-columns:1fr 1fr;gap:8px;position:relative;z-index:10;flex:1;left:62%;opacity:.8">挥斩</button><img src="data:image/webp;base64,AAAA"><svg viewBox="0 0 100 100"><polygon points="1,2 3,4 5,6" fill="#efcc83"/><text x="5" y="6" text-anchor="middle">剑</text></svg>');
  expect(clean).toContain('data-act="strike"');expect(clean).toContain('aria-label="挥斩"');expect(clean).toContain('disabled');
  expect(clean).toContain('grid-template-columns:1fr 1fr');expect(clean).toContain('data:image/webp;base64,AAAA');
  for(const declaration of ['position:relative','z-index:10','flex:1','left:62%','opacity:.8'])expect(clean).toContain(declaration);
  expect(clean).toContain('<svg viewbox="0 0 100 100">');expect(clean).toContain('<polygon');expect(clean).toContain('text-anchor="middle"');
 });
 it('rebases only local site-root URLs, preserving the same root URLs during root hosting',()=>{
  vi.stubGlobal('document',{baseURI:'https://games.example/nested/game/index.html'});
  expect(packageUrl('/assets/v8/bg_road.webp')).toBe('/nested/game/assets/v8/bg_road.webp');
  expect(sanitizeHtml('<a href="/campaign.html">old</a><img src="/assets/v8/bg_road.webp">')).toContain('href="/nested/game/campaign.html"');
  expect(packageCssUrls('url("/assets/v8/bg_forge.webp")')).toBe('url("/nested/game/assets/v8/bg_forge.webp")');
  expect(packageUrl('blob:https://games.example/id')).toBe('blob:https://games.example/id');
  vi.stubGlobal('document',{baseURI:'https://games.example/index.html'});
  expect(packageUrl('/assets/v8/bg_road.webp')).toBe('/assets/v8/bg_road.webp');
 });
 it('keeps arbitrary-directory offline URLs within that directory',()=>{
  vi.stubGlobal('document',{baseURI:'file:///home/player/Some%20Game/index.html'});
  expect(packageUrl('/assets/v8/bg_road.webp')).toBe('file:///home/player/Some%20Game/assets/v8/bg_road.webp');
 });
});
