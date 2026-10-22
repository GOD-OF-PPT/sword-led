import type {Page} from '@playwright/test';

/** Current release observer; no production styles, state or economic operation are changed. */
export const REQUIRED_WORKSHOP_TEXT=['#v4-goal-name','#v4-goal-condition','#v4-risk','#v4-value'] as const;
interface Rect {x:number;y:number;width:number;height:number}
export interface ReleaseTextMetric {
 text:string;
 selector:string;
 fontSize:number;
 minContrast:number;
 effectiveOpacity:number;
 sourceRects:Rect[];
 visibleRects:Rect[];
}
export interface ReleaseReadability {
 metrics:ReleaseTextMetric[];
 excluded:{text:string;selector:string;reason:string}[];
 required:{selector:string;text:string|null;visibleSamples:number;fullyPainted:boolean}[];
 method:string;
}
interface Options {requiredSelectors?:readonly string[]}

/**
 * Uses the old actual-pixel method, with explicit painted-region eligibility.
 * A closed details panel, a clipped screen-reader node, or text outside a scrollport
 * is not a visible contrast sample. Opening/scrolling those surfaces is a separate
 * caller responsibility, and excluded evidence remains in the returned result.
 */
export async function renderedReleaseTextReadability(page:Page,rootSelector='#app',options:Options={}):Promise<ReleaseReadability>{
 const collected=await page.evaluate(({rootSelector,requiredSelectors})=>{
  type Box={left:number;top:number;right:number;bottom:number};
  type SavedStyle={node:HTMLElement;style:string|null};
  const root=document.querySelector(rootSelector);if(!root)throw Error('Readability root is absent: '+rootSelector);
  const excluded:{text:string;selector:string;reason:string}[]=[],parents=new Set<HTMLElement>();
  const candidates:{text:string;selector:string;fontSize:number;color:number[];effectiveOpacity:number;sourceRects:Rect[];visibleRects:Rect[];required:string[]}[]=[];
  const selector=(node:HTMLElement)=>node.id?'#'+node.id:node.tagName.toLowerCase()+(node.classList.length?'.'+[...node.classList].join('.'):''),box=(rect:DOMRect):Box=>({left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom});
  const area=(value:Box)=>Math.max(0,value.right-value.left)*Math.max(0,value.bottom-value.top);
  const intersect=(first:Box,second:Box,clipX=true,clipY=true):Box=>({left:clipX?Math.max(first.left,second.left):first.left,right:clipX?Math.min(first.right,second.right):first.right,top:clipY?Math.max(first.top,second.top):first.top,bottom:clipY?Math.min(first.bottom,second.bottom):first.bottom});
  const asRect=(value:Box):Rect=>({x:value.left,y:value.top,width:value.right-value.left,height:value.bottom-value.top});
  const number=(token:string,extent:number)=>token.endsWith('%')?parseFloat(token)/100*extent:parseFloat(token);
  function inset(value:string,rect:DOMRect):Box|null{
   const matched=/^inset\(([^)]+)\)$/.exec(value);if(!matched)return null;
   const source=matched[1]!.split(/\s+round\s+/)[0]!,tokens=source.trim().split(/\s+/);if(tokens.length<1||tokens.length>4)return null;
   const offsets=[tokens[0]!,tokens[1]??tokens[0]!,tokens[2]??tokens[0]!,tokens[3]??tokens[1]??tokens[0]!];
   const top=number(offsets[0]!,rect.height),right=number(offsets[1]!,rect.width),bottom=number(offsets[2]!,rect.height),left=number(offsets[3]!,rect.width);
   if(![top,right,bottom,left].every(Number.isFinite))throw Error('Unresolved clipping inset: '+value);
   return{left:rect.left+left,right:rect.right-right,top:rect.top+top,bottom:rect.bottom-bottom};
  }
  function visibleParts(parent:HTMLElement,source:DOMRect[]){
   let parts=source.map(box).map(rect=>intersect(rect,{left:0,top:0,right:innerWidth,bottom:innerHeight})),opacity=1;
   for(let node:HTMLElement|null=parent;node;node=node.parentElement){
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    if(node.hidden||style.display==='none'||style.visibility!=='visible')return{parts:[],opacity,reason:'hidden/display/visibility ancestor '+selector(node)};
    opacity*=Number(style.opacity);if(opacity<=0)return{parts:[],opacity,reason:'zero-opacity ancestor '+selector(node)};
    if(style.contentVisibility==='hidden')return{parts:[],opacity,reason:'content-visibility:hidden '+selector(node)};
    if(node instanceof HTMLDetailsElement&&!node.open){
     const summary=[...node.children].find(child=>child.tagName==='SUMMARY');
     if(!summary?.contains(parent))return{parts:[],opacity,reason:'closed details content '+selector(node)};
    }
    if(style.clipPath!=='none'){
     const clip=inset(style.clipPath,rect);
     // Never silently discard visible text just because a clip shape is unsupported.
     if(!clip)throw Error('Readability requires an explicit mask for clip-path '+style.clipPath+' on '+selector(node));
     parts=parts.map(part=>intersect(part,clip));
    }
    if(style.clip!=='auto'){
     const matched=/^rect\(([^)]+)\)$/.exec(style.clip);
     if(!matched)throw Error('Unresolved legacy clip: '+style.clip);
     const tokens=matched[1]!.split(/[,\s]+/).filter(Boolean);if(tokens.length!==4||tokens.includes('auto'))throw Error('Readability needs explicit legacy clip offsets: '+style.clip);
     const offsets=tokens.map(parseFloat);if(!offsets.every(Number.isFinite))throw Error('Invalid legacy clip: '+style.clip);
     parts=parts.map(part=>intersect(part,{left:rect.left+offsets[3]!,top:rect.top+offsets[0]!,right:rect.left+offsets[1]!,bottom:rect.top+offsets[2]!}));
    }
    const clipX=/^(hidden|clip|auto|scroll)$/.test(style.overflowX),clipY=/^(hidden|clip|auto|scroll)$/.test(style.overflowY),paintContain=/(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(style.contain);
    if(clipX||clipY||paintContain){
     // Scrollbars/borders are outside the actual ancestor client area.
     const client={left:rect.left+node.clientLeft,top:rect.top+node.clientTop,right:rect.left+node.clientLeft+node.clientWidth,bottom:rect.top+node.clientTop+node.clientHeight};
     parts=parts.map(part=>intersect(part,client,clipX||paintContain,clipY||paintContain));
    }
    parts=parts.filter(part=>area(part)>0);
    if(!parts.length)return{parts:[],opacity,reason:'fully clipped by '+selector(node)};
   }
   parts=parts.filter(part=>part.right-part.left>1&&part.bottom-part.top>1);
   return{parts,opacity,reason:parts.length?'':'no painted text area larger than1px'};
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
   const parent=node.parentElement,text=node.textContent?.trim();if(!(parent instanceof HTMLElement)||!text)continue;
   const label=selector(parent);
   if(parent.closest(':disabled,[aria-hidden=true]')){excluded.push({text:text.slice(0,100),selector:label,reason:'disabled or aria-hidden decorative subtree'});continue;}
   const style=getComputedStyle(parent),range=document.createRange();range.selectNodeContents(node);const original=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0),visible=visibleParts(parent,original);
   if(!visible.parts.length){excluded.push({text:text.slice(0,100),selector:label,reason:visible.reason||'no layout rect'});continue;}
   const color=style.color.match(/[\d.]+/g)?.map(Number)??[];if(color.length===3)color.push(1);if(color.length!==4)throw Error('Unsupported computed text color '+style.color+' on '+label);
   const required=requiredSelectors.filter(target=>{const control=document.querySelector(target);return control===parent||!!control?.contains(parent);});
   candidates.push({text:text.slice(0,100),selector:label,fontSize:parseFloat(style.fontSize),color,effectiveOpacity:visible.opacity,sourceRects:original.map(rect=>asRect(box(rect))),visibleRects:visible.parts.map(asRect),required});parents.add(parent);
  }
  const required=requiredSelectors.map(target=>{const samples=candidates.filter(sample=>sample.required.includes(target)),pixels=(rects:Rect[])=>rects.reduce((sum,rect)=>sum+rect.width*rect.height,0);return{selector:target,text:document.querySelector(target)?.textContent?.trim()??null,visibleSamples:samples.length,fullyPainted:samples.length>0&&samples.every(sample=>pixels(sample.visibleRects)+.1>=pixels(sample.sourceRects)*.99)};});
  const styles:SavedStyle[]=[...parents].map(node=>({node,style:node.getAttribute('style')}));Reflect.set(window,'__t03ReadabilitySavedStyles',styles);
  for(const {node}of styles){node.style.setProperty('color','transparent','important');node.style.setProperty('text-shadow','none','important');}
  return{candidates,excluded,required};
 },{rootSelector,requiredSelectors:[...(options.requiredSelectors??[])]});
 try{
  const background=await page.screenshot();
  const metrics=await page.evaluate(async({base64,samples})=>{
   const bytes=Uint8Array.from(atob(base64),value=>value.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes])),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const context=canvas.getContext('2d');if(!context)throw Error('Readability pixel context unavailable');context.drawImage(bitmap,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data,scale=canvas.width/innerWidth;
   const luminance=(rgb:number[])=>{const linear=rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return .2126*linear[0]!+.7152*linear[1]!+.0722*linear[2]!;};
   const result=samples.map(sample=>{
    let minContrast=Infinity;
    for(const rect of sample.visibleRects){const left=Math.max(0,Math.ceil(rect.x*scale)),top=Math.max(0,Math.ceil(rect.y*scale)),right=Math.min(canvas.width,Math.floor((rect.x+rect.width)*scale)),bottom=Math.min(canvas.height,Math.floor((rect.y+rect.height)*scale));
     for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*canvas.width+x)*4,bg=[pixels[i]!,pixels[i+1]!,pixels[i+2]!],alpha=sample.color[3]!*sample.effectiveOpacity,fg=bg.map((value,index)=>value*(1-alpha)+sample.color[index]!*alpha),a=luminance(bg),b=luminance(fg);minContrast=Math.min(minContrast,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));}
    }
    if(!Number.isFinite(minContrast))throw Error('Visible sample contained no real image pixels: '+sample.selector);
    return{text:sample.text,selector:sample.selector,fontSize:sample.fontSize,minContrast,effectiveOpacity:sample.effectiveOpacity,sourceRects:sample.sourceRects,visibleRects:sample.visibleRects};
   });bitmap.close();return result;
  },{base64:background.toString('base64'),samples:collected.candidates});
  const missing=collected.required.filter(item=>item.visibleSamples===0||!item.fullyPainted);if(missing.length)throw Error('Required fields were not fully sampled as painted text: '+JSON.stringify({missing,excluded:collected.excluded}));
  return{metrics,excluded:collected.excluded,required:collected.required,method:'Actual background pixels with glyphs temporarily transparent; visible rects intersect viewport and every clipping/scroll ancestor. Required fields need at least99 percent of their source rect area, so a clipped sliver cannot satisfy coverage. Closed details and entirely clipped1px auxiliary text are separately recorded. Opaque text uses original color and actual background. Partly translucent visible text is retained with an effective-alpha estimate; group-opacity composition is a stated limitation rather than a claim of exact final foreground pixels. No pointer-events hit test, domain mutation or CSS threshold relaxation.'};
 }finally{
  await page.evaluate(()=>{const styles=Reflect.get(window,'__t03ReadabilitySavedStyles') as {node:HTMLElement;style:string|null}[]|undefined;for(const {node,style}of styles??[])if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);Reflect.deleteProperty(window,'__t03ReadabilitySavedStyles');});
 }
}
