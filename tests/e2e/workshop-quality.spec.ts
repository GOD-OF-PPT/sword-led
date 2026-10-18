import { test, expect } from './fixtures';
import { openGame, preciseKeyStrike, readRun, startGame } from './helpers';
import { writeFile } from 'node:fs/promises';

test('visible workshop text meets the typography and contrast contract, including preparation', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });await openGame(page);
  const menu = info.outputPath('main-menu.png');await page.screenshot({ path: menu });await info.attach('main-menu', { path: menu, contentType: 'image/png' });
  await startGame(page);
  const audit = async () => page.locator('#piece-title,#piece-progress,#integrity,#heat,#stress,#break-warning,#strike,#deliver-button,#recycle-button,#settle-button,#mode-light,#mode-standard,#mode-heavy,#coins,#scrap,#coal,#round,#delivered,#deficit,#risk-precise,#risk-ordinary,#risk-mishit,.mode-buttons kbd,.piece-card .material-name,.piece-card .tier-name,.piece-card .piece-state').evaluateAll(elements => {
    const parse = (value: string) => { const parts = value.match(/[\d.]+/g)?.map(Number) ?? [0,0,0];return [parts[0] ?? 0,parts[1] ?? 0,parts[2] ?? 0,parts[3] ?? 1]; };
    const luminance = (rgb: number[]) => { const channels = rgb.slice(0,3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);return .2126*(channels[0]??0)+.7152*(channels[1]??0)+.0722*(channels[2]??0); };
    return elements.map(element => {
      const ancestors: Element[] = [];for(let current: Element|null=element;current;current=current.parentElement)ancestors.unshift(current);
      let background=[255,255,255];
      for(const ancestor of ancestors){const color=parse(getComputedStyle(ancestor).backgroundColor),alpha=color[3]??1;background=background.map((value,index)=>value*(1-alpha)+(color[index]??0)*alpha);}
      const style=getComputedStyle(element), foreground=parse(style.color), a=luminance(foreground), b=luminance(background);
      return {text:element.textContent?.trim().slice(0,35),fontSize:parseFloat(style.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
  });
  const idle=await audit();await page.locator('#strike').focus();await page.keyboard.down('Space');await page.clock.runFor(175);const preparing=await audit();
  expect([...idle,...preparing].filter(value=>value.contrast<4.5||value.fontSize<12)).toEqual([]);
  await page.keyboard.press('Escape');await page.keyboard.up('Space');const pause=info.outputPath('paused-workshop.png');await page.screenshot({path:pause});await info.attach('paused-workshop',{path:pause,contentType:'image/png'});
  const report=info.outputPath('workshop-readability.json');await writeFile(report,JSON.stringify({idle,preparing},null,2));await info.attach('workshop-readability',{path:report,contentType:'application/json'});
});

test('system reduced motion is honoured without changing the strike reward', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });await openGame(page);await startGame(page);
  await preciseKeyStrike(page);const state=await readRun(page);expect(state.pieces[0]).toMatchObject({progress:3,heat:88});
  await page.locator('#pause').click();await page.getByRole('button',{name:'操作设置',exact:true}).click();
  await expect(page.locator('#motion-setting')).toBeChecked();await expect(page.locator('#motion-setting')).toBeDisabled();
});

test('the lesson displays its true cracked piece and supports non-destructive return', async ({ page }, info) => {
  await page.setViewportSize({width:1280,height:720});await openGame(page);await page.locator('#practice').click();await page.locator('#lesson-next').click();
  await expect(page.locator('#break-warning')).toContainText('只剩 1 格');await expect(page.locator('#lesson-banner')).toContainText('固定的练习示例');
  for(const selector of ['#lesson-next','#strike','#risk-row','#piece-3','#break-warning','#stress-meter'])await expect(page.locator(selector)).toBeInViewport({ratio:.95});
  const file=info.outputPath('tutorial-crack.png');await page.screenshot({path:file});await info.attach('tutorial-crack',{path:file,contentType:'image/png'});
  expect(await page.evaluate(()=>localStorage.getItem('sword-led.save.v1'))).toBeNull();await page.locator('#lesson-exit').click();await expect(page.locator('#menu')).toBeVisible();
});
