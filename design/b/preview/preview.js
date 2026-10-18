import { loadArt, paintWorkshop, paintSwatch } from './scene.js';
const TIERS = ['粗坯','整形','淬炼','成刃','精工','上品','名作','传世'];
const form = document.querySelector('#controls'), scene = document.querySelector('#scene');
const status = document.querySelector('#status');
let art, animation = 0;
function options() {
  const values = new FormData(form);
  return { material: values.get('material'), tier: Number(values.get('tier')), heat: Number(values.get('heat')),
    integrity: Number(values.get('integrity')), hammer: values.get('hammer'), level: Number(values.get('level')),
    pose: values.get('pose'), feedback: values.get('feedback'), broken: values.has('broken') };
}
function draw() {
  if (!art) return;
  document.querySelector('#heat-value').value = form.elements.heat.value;
  return paintWorkshop(scene, art, options());
}
function resetIntegrity() {
  const maximum = {iron:4,steel:3,meteorite:2}[form.elements.material.value];
  form.elements.integrity.replaceChildren(...Array.from({length:maximum},(_,index)=>new Option(`${index+1} / ${maximum}`,String(index+1))));
  form.elements.integrity.value = String(maximum);
}
function makeCard(parent, title, opts) {
  const card = document.createElement('article');card.className = parent.id === 'atlas' ? 'atlas-card' : 'state-card';
  const canvas = document.createElement('canvas');canvas.setAttribute('aria-label',title);
  const label = document.createElement('p');label.textContent = title;card.append(canvas,label);parent.append(card);
  paintSwatch(canvas,art,opts);return {canvas,opts};
}
function luminance(hex) {
  const [r,g,b]=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
}
const swatches=[];
try {
  art = await loadArt();
  form.elements.tier.replaceChildren(...TIERS.map((label,index)=>new Option(`${index} · ${label}`,String(index))));
  form.elements.tier.value = '3';resetIntegrity();
  const states = document.querySelector('#states');
  for(const [title,opts]of[
    ['冷却 · 热度 0',{heat:0,integrity:3}],['炉热 · 热度 100',{heat:100,integrity:3}],
    ['裂损 · 完整度 2 / 3',{heat:40,integrity:2}],['临界 · 完整度 1 / 3',{heat:40,integrity:1}],
    ['已破碎 · 分片',{heat:20,integrity:0,broken:true}],['交货 · 保留形态',{heat:0,integrity:3}],
    ['回收 · 失去交货价值',{heat:0,integrity:1,broken:true}],['减弱动效 · 静态读数',{heat:40,integrity:3}],
  ])swatches.push(makeCard(states,title,{material:'steel',tier:3,...opts}));
  const atlas=document.querySelector('#atlas');
  for(let tier=0;tier<8;tier++)for(const material of ['iron','steel','meteorite'])swatches.push(makeCard(atlas,`${tier} · ${TIERS[tier]}`,{material,tier,heat:0,integrity:4}));
  for(const [key,color]of Object.entries(art.manifest.palette)){
    const card=document.createElement('div');card.className='color';
    const sample=document.createElement('i');sample.style.background=color;
    const label=document.createElement('code');const a=luminance(color),b=luminance(art.manifest.palette.paper);
    label.textContent=`${key} ${color} · 对纸色 ${((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)}:1`;
    card.append(sample,label);document.querySelector('#palette').append(card);
  }
  status.textContent = `9 张运行图已加载 · 24 帧材料 · ${ (art.manifest.assets.reduce((sum,a)=>sum+a.bytes,0)/1024/1024).toFixed(2) } MiB · 仅美术预览`;
  form.addEventListener('input',event=>{cancelAnimationFrame(animation);if(event.target.name==='material')resetIntegrity();draw();});
  form.addEventListener('submit',event=>event.preventDefault());
  document.querySelector('#play').addEventListener('click',()=>{
    cancelAnimationFrame(animation);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){paintWorkshop(scene,art,{...options(),pose:'contact',feedback:'ordinary'});return;}
    const start=performance.now(),initial=options();
    const tick=now=>{const p=Math.min(1,(now-start)/450),angle=p<.4?art.manifest.stage.idleAngle*(1-p/.4):p<.6?-.025:art.manifest.stage.idleAngle*(p-.6)/.4;
      paintWorkshop(scene,art,{...initial,angle,feedback:p>=.4&&p<.65?'ordinary':'none'});
      if(p<1)animation=requestAnimationFrame(tick);else draw();};animation=requestAnimationFrame(tick);
  });
  new ResizeObserver(()=>{draw();for(const swatch of swatches)paintSwatch(swatch.canvas,art,swatch.opts);}).observe(document.querySelector('main'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(animation);draw();}});
  draw();
  // Exposed only on the unbundled design page for exhaustive art assembly verification.
  window.artPreview={art,draw,paint:opts=>paintWorkshop(scene,art,opts),swatches};
}catch(error){status.textContent=`美术加载失败：${error.message}`;status.dataset.error='true';throw error;}
