import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as sdk from '../../previews/T11-4-2-3k-formed/sword-led-v4.js';

const out = process.argv.slice(2).find(value=>!value.startsWith('--')) ?? 'tmp/T11-4-2-3m/old-repro/run-02';
const onlyCharge = process.argv.includes('--charge-only');
const url = 'http://127.0.0.1:4179/';
const sdkFile = 'tmp/previews/T11-4-2-3k-formed/sword-led-v4.js';
const witnessFile = 'docs/evidence/T11-4-2-3i1/witness-fixed/complete.json';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, {recursive:true});
const sdkBytes = await readFile(sdkFile);
const servedSdk = Buffer.from(await (await fetch(new URL('sword-led-v4.js', url))).arrayBuffer());
assert.equal(hash(servedSdk), hash(sdkBytes), 'Official server must still serve the immutable old SDK.');
const witness = JSON.parse(await readFile(witnessFile, 'utf8'));
assert(sdk.validateRun(witness).ok, 'Historical witness must replay under the immutable formal SDK.');
const created = sdk.createRun({runId:witness.runId, seed:witness.seed, mode:witness.mode, eligibility:witness.initialEligibility});
assert(created.ok);
let state = created.state;
const prefixes = [], results = [], errors = [];
for (const action of witness.journal) {
  prefixes.push(state);
  const applied = sdk.applyCommand(state, {runId:state.runId, expectedRevision:state.revision, action});
  assert(applied.ok, applied.error);
  state = applied.state;
}
assert.deepEqual(state, witness);
const browser = await chromium.launch();
async function save(name, value) {await writeFile(`${out}/${name}.json`, JSON.stringify(value, null, 2)+'\n');}
async function actual(page) {
  const raw = await page.evaluate(() => localStorage.getItem('sword-led.save.v4'));
  assert(raw);
  const value = sdk.validateRun(JSON.parse(raw).state);
  assert(value.ok, value.detail);
  return value.state;
}
async function ui(page) {
  return page.evaluate(() => ({
    title:document.querySelector('#v4-notice-title')?.textContent,
    copy:document.querySelector('#v4-notice-copy')?.textContent,
    noticeHidden:document.querySelector('#v4-notice')?.hidden,
    noticeAction:document.querySelector('#v4-notice-action')?.textContent,
    actionDisabled:document.querySelector('#v4-notice-action')?.disabled,
    busy:document.querySelector('#v4-strike')?.getAttribute('aria-busy'),
    deliver:document.querySelector('#v4-deliver')?.textContent,
    deliverDisabled:document.querySelector('#v4-deliver')?.disabled,
    focused:document.activeElement?.id,
    selected:document.querySelector('#v4-inventory button[aria-pressed="true"]')?.dataset.piece,
    risk:document.querySelector('#v4-risk')?.textContent,
    trusted:window.reproTrusted
  }));
}
async function setup(name, index, pieceId) {
  const prefix = prefixes[index];
  assert(sdk.validateRun(prefix).ok);
  const values = new Map();
  const repository = sdk.createV4SaveRepository(() => ({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}));
  repository.load();
  assert(repository.write(prefix).ok);
  const raw = values.get('sword-led.save.v4');
  await save(`${name}-prefix`, prefix);
  await writeFile(`${out}/${name}-envelope.json`, raw+'\n');
  const context = await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript(raw => {
    localStorage.setItem('sword-led.save.v4', raw);
    window.reproTrusted=[];
    document.addEventListener('click', event => {
      const target=event.target.closest?.('button');
      if(target)window.reproTrusted.push({type:event.type,isTrusted:event.isTrusted,target:target.id||target.dataset.piece||target.textContent,time:performance.now(),busy:document.querySelector('#v4-strike')?.getAttribute('aria-busy')});
    },true);
  }, raw);
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push({case:name,message:error.message}));
  await page.goto(url);
  await expect(page.locator('#v4-continue')).toBeEnabled();
  await page.locator('#v4-continue').click();
  const choice = page.locator(`#v4-inventory button[data-piece="${pieceId}"]`);
  if(await choice.getAttribute('aria-pressed')!=='true')await choice.click();
  assert.deepEqual(await actual(page), prefix);
  return {context,page,prefix};
}
async function strike(page,pieceId,{wait=true}={}) {
  const before=await actual(page), action={type:'strike',pieceId};
  const expected=sdk.applyCommand(before,{runId:before.runId,expectedRevision:before.revision,action});
  assert(expected.ok,expected.error);
  await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
  await page.locator('#v4-hit').click({position:{x:250,y:170}});
  if(wait)await expect(page.locator('#v4-strike')).toHaveAttribute('aria-busy','false');
  assert.deepEqual(await actual(page),expected.state);
  return expected;
}
try {
  {
    const name='charge-consumed', {context,page,prefix}=await setup(name,55,'d4-2');
    const charged=await strike(page,'d4-2');
    const chargedUI=await ui(page);
    assert.equal(charged.state.blades.find(b=>b.id==='d4-2').charge,6);
    assert.equal(chargedUI.title,'锤势已满');
    await save(`${name}-charged`,charged.state);
    await page.screenshot({path:`${out}/${name}-before.png`});
    const burst=await strike(page,'d4-2'), afterUI=await ui(page);
    assert(burst.events.find(e=>e.type==='Strike')?.burst);
    assert.equal(burst.state.blades.find(b=>b.id==='d4-2').charge,0);
    const reproduced=afterUI.title==='锤势已满'&&afterUI.copy.includes('下一次落锤是安全连锻');
    await save(`${name}-after`,burst.state);
    await page.screenshot({path:`${out}/${name}-after.png`});
    const record={name,reproduced,method:'Historical legal prefix index 55; two real UI strikes; no field injection. Unlike day 3, this burst does not newly qualify the sword and mask the old notice.',prefixRevision:prefix.revision,acceptedActions:2,chargedUI,afterUI,actualCharge:0,ordinaryOdds:sdk.getRunView(burst.state).blades.find(b=>b.blade.id==='d4-2').odds};
    results.push(record);await save(name,record);await context.close();
  }
  if(!onlyCharge){
    const name='ready-to-other-sword', {context,page,prefix}=await setup(name,3,'d1-1');
    const ready=await strike(page,'d1-1'), readyUI=await ui(page);
    assert.equal(readyUI.title,'这柄剑，已经合格了');
    await save(`${name}-qualified`,ready.state);
    await page.screenshot({path:`${out}/${name}-before.png`});
    await page.locator('#v4-inventory button[data-piece="d1-2"]').click();
    const afterChoose=await ui(page);
    await page.locator('#v4-notice-action').click();
    const afterUI=await ui(page);
    assert.deepEqual(await actual(page),ready.state,'Selecting/focusing must not dispatch or sell.');
    const reproduced=afterUI.title==='这柄剑，已经合格了'&&afterUI.focused==='v4-deliver'&&afterUI.deliver.startsWith('卖给行会')&&afterUI.selected==='d1-2';
    await save(`${name}-after`,await actual(page));
    await page.screenshot({path:`${out}/${name}-after.png`});
    const record={name,reproduced,method:'Historical legal prefix index 3; one real UI strike, other-sword click, notice-action click. No sale activated.',prefixRevision:prefix.revision,acceptedActions:1,readyUI,afterChoose,afterUI};
    results.push(record);await save(name,record);await context.close();
  }
  if(!onlyCharge){
    const name='broken-next-busy', {context,page,prefix}=await setup(name,139,'d9-1');
    const broken=await strike(page,'d9-1',{wait:false}), beforeClick=await ui(page);
    assert.equal(beforeClick.title,'剑断了，炉火还在');
    assert.equal(beforeClick.busy,'true','Need a genuine click within the active hit presentation.');
    assert.equal(beforeClick.actionDisabled,false);
    // Playwright force bypasses actionability waiting only; the browser still dispatches a trusted pointer click.
    await page.locator('#v4-notice-action').click({force:true});
    const immediate=await ui(page);
    await page.screenshot({path:`${out}/${name}-immediate.png`});
    await page.waitForTimeout(1400);
    const afterUI=await ui(page), after=await actual(page);
    const trustedNext=afterUI.trusted.some(e=>e.target==='v4-notice-action'&&e.isTrusted&&e.busy==='true');
    assert.deepEqual(after,broken.state);
    const stuck=afterUI.busy==='true'&&afterUI.deliverDisabled&&afterUI.selected!=='d9-1';
    const next=after.blades.find(b=>b.id===afterUI.selected), revision=after.revision;
    await page.locator('#v4-hit').click({position:{x:250,y:170}});
    await page.waitForTimeout(300);
    const afterAttempt=await ui(page), final=await actual(page);
    const reproduced=trustedNext&&stuck&&final.revision===revision&&afterAttempt.busy==='true';
    await save(`${name}-broken`,broken.state);await save(`${name}-after`,final);
    await page.screenshot({path:`${out}/${name}-after.png`});
    const record={name,reproduced,method:'Historical legal prefix index 139; one real UI broken strike, trusted next click during busy, 1400 ms observation and one no-op attempted strike. No infinite-duration claim.',prefixRevision:prefix.revision,acceptedActions:1,trustedNext,beforeClick,immediate,afterUI,afterAttempt,nextSwordActive:next?.status==='active',nextSwordCanStrike:sdk.getRunView(final).blades.find(b=>b.blade.id===next?.id)?.canStrike,acceptedActionsAfterAttempt:final.revision-revision};
    results.push(record);await save(name,record);await context.close();
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  const result={ok:true,url,serverPid:32067,sdkFile,sdkSha256:hash(sdkBytes),servedSdkSha256:hash(servedSdk),witnessFile,witnessSha256:hash(await readFile(witnessFile)),scope:onlyCharge?'One follow-up old-version full-charge case; historical legal prefix and two accepted real UI strikes. Initial unconfirmed case is preserved separately.':'Three old-version interaction cases in isolated Chromium contexts; historical-prefix replay plus four accepted UI strike commands. Not whole-game runs, compatibility matrix, or v0.8.',results,errors};
  await save('result',result);console.log(JSON.stringify(result,null,2));
} catch(error) {
  await save('failure',{message:String(error),stack:error.stack,results,errors});throw error;
} finally {await browser.close();}
