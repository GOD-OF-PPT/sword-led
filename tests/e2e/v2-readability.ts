import type {Page} from '@playwright/test';

/** Sample rendered backgrounds with glyphs temporarily transparent; retain an unmodified screenshot separately. */
export async function renderedTextReadability(page:Page,rootSelector='#app'){
  const samples=await page.evaluate(rootSelector=>{
    const result:{text:string;fontSize:number;color:number[];rects:{x:number;y:number;width:number;height:number}[]}[]=[],parents=new Set<HTMLElement>();
    const walker=document.createTreeWalker(document.querySelector(rootSelector)!,NodeFilter.SHOW_TEXT);
    for(let n=walker.nextNode();n;n=walker.nextNode()){
      const parent=n.parentElement;if(!(parent instanceof HTMLElement)||!n.textContent?.trim()||!parent.getClientRects().length||parent.closest(':disabled,[aria-hidden=true]'))continue;
      const style=getComputedStyle(parent);let opaque=true;for(let p:Element|null=parent;p;p=p.parentElement)if(Number(getComputedStyle(p).opacity)<.999)opaque=false;
      if(!opaque||style.visibility!=='visible')continue;const range=document.createRange();range.selectNodeContents(n);const rects=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}));if(!rects.length)continue;
      const color=style.color.match(/[\d.]+/g)?.map(Number)??[];if(color.length<4)color.push(1);result.push({text:n.textContent.trim().slice(0,100),fontSize:parseFloat(style.fontSize),color,rects});parents.add(parent);
    }
    // Test-owned DOM styles only; no application state/command mutation.
    const saved=[...parents].map(parent=>({parent,style:parent.getAttribute('style')}));Reflect.set(window,'readabilityV2Styles',saved);
    for(const {parent}of saved){parent.style.setProperty('color','transparent','important');parent.style.setProperty('text-shadow','none','important');}
    return result;
  },rootSelector);
  try{
    const background=await page.screenshot();return await page.evaluate(async({base64,samples})=>{
      const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes]));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const c=canvas.getContext('2d');if(!c)throw Error('2d');c.drawImage(bitmap,0,0);const data=c.getImageData(0,0,canvas.width,canvas.height).data,scale=canvas.width/innerWidth;
      const lum=(rgb:number[])=>{const a=rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*(a[0]??0)+.7152*(a[1]??0)+.0722*(a[2]??0);};
      const results=samples.map(sample=>{let minContrast=Infinity;for(const rect of sample.rects){const left=Math.ceil(rect.x*scale),top=Math.ceil(rect.y*scale),right=Math.min(canvas.width,Math.floor((rect.x+rect.width)*scale)),bottom=Math.min(canvas.height,Math.floor((rect.y+rect.height)*scale));for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*canvas.width+x)*4,bg=[data[i]??0,data[i+1]??0,data[i+2]??0],alpha=sample.color[3]??1,fg=bg.map((v,j)=>v*(1-alpha)+(sample.color[j]??0)*alpha),a=lum(bg),b=lum(fg);minContrast=Math.min(minContrast,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));}}return{text:sample.text,fontSize:sample.fontSize,minContrast};});bitmap.close();return results;
    },{base64:background.toString('base64'),samples});
  }finally{await page.evaluate(()=>{const saved=Reflect.get(window,'readabilityV2Styles') as {parent:HTMLElement;style:string|null}[];for(const {parent,style}of saved)if(style===null)parent.removeAttribute('style');else parent.setAttribute('style',style);Reflect.deleteProperty(window,'readabilityV2Styles');});}
}
