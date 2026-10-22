interface ArtworkHost {changed():void;failed():void}
interface ArtworkSource {canonical:string;source:string;failed:boolean}
interface ImageBinding {source:ArtworkSource;fallback:string;expected:string;loading:boolean}
interface ArtworkProbe {clear():void}

/** Retain failed source identities, never the transient dialog images that displayed them. */
export function createArtworkRecovery(root:HTMLElement,host:ArtworkHost){
 const sources=new Map<string,ArtworkSource>(),probes=new Map<string,ArtworkProbe>();
 let bindings=new WeakMap<HTMLImageElement,ImageBinding>(),disposed=false,retries=0;
 const absolute=(source:string)=>new URL(source,root.ownerDocument.baseURI).href;
 const changed=()=>{if(!disposed)host.changed();};
 const images=()=>root.querySelectorAll<HTMLImageElement>('img[data-artwork-source]');
 const owns=(image:HTMLImageElement,binding:ImageBinding)=>!disposed&&bindings.get(image)===binding&&absolute(image.getAttribute('src')??'')===binding.expected;

 function display(image:HTMLImageElement,source:ArtworkSource,fallback:string){
  const expected=absolute(source.failed?fallback:source.source),previous=bindings.get(image);
  if(previous?.source===source&&previous.fallback===fallback&&previous.expected===expected&&absolute(image.getAttribute('src')??'')===expected)return;
  const binding:ImageBinding={source,fallback,expected,loading:!source.failed};bindings.set(image,binding);
  image.dataset.artworkSource=absolute(source.canonical);
  image.onload=null;image.onerror=null;
  if(!source.failed){
   const ready=()=>{
    if(!owns(image,binding)||!binding.loading||binding.expected!==absolute(source.source)||!image.complete||image.naturalWidth===0)return;
    binding.loading=false;image.onload=null;image.onerror=null;changed();
   };
   const failed=()=>{
    if(!owns(image,binding)||!binding.loading||binding.expected!==absolute(source.source)||!image.complete||image.naturalWidth>0)return;
    binding.loading=false;const first=!source.failed;source.failed=true;
    // Fallback loading is deliberately outside the canonical source's success path.
    display(image,source,fallback);if(first&&!disposed)host.failed();changed();
   };
   image.onload=ready;image.onerror=failed;image.src=source.source;
   if(image.complete)queueMicrotask(()=>{if(image.naturalWidth>0)ready();else failed();});
  }else image.src=fallback;
 }

 function image(node:HTMLImageElement,canonical:string,fallback:string){
  if(disposed)return;const key=absolute(canonical);let source=sources.get(key);
  if(!source){source={canonical,source:canonical,failed:false};sources.set(key,source);}
  display(node,source,fallback);
 }
 function status(){
  let loading=probes.size>0;
  for(const node of images()){const binding=bindings.get(node);if(binding?.loading&&owns(node,binding)&&binding.expected===absolute(binding.source.source))loading=true;}
  return{loading,failed:[...sources.values()].filter(source=>source.failed).map(source=>source.canonical)};
 }
 function retry(){
  if(disposed)return;
  for(const [key,source]of sources){
   if(!source.failed||probes.has(key))continue;
   const picture=new Image(),url=new URL(source.canonical,root.ownerDocument.baseURI);
   url.searchParams.set('artRetry',`${Date.now()}-${++retries}`);const requested=url.href;
   let timer:ReturnType<typeof setTimeout>|null=null,finished=false;
   const job:ArtworkProbe={clear(){picture.onload=null;picture.onerror=null;if(timer!==null)clearTimeout(timer);timer=null;picture.removeAttribute('src');}};
   const finish=(ok:boolean)=>{
    if(disposed||finished||probes.get(key)!==job)return;finished=true;job.clear();probes.delete(key);
    if(ok){
     source.source=requested;source.failed=false;
     // Only current descendants are scanned. Detached dialog nodes are never retained for restoration.
     if(url.origin===new URL(root.ownerDocument.baseURI).origin)for(const node of images()){
      const binding=bindings.get(node);if(binding?.source===source&&node.dataset.artworkSource===key)display(node,source,binding.fallback);
     }
    }else{source.failed=true;host.failed();}
    changed();
   };
   picture.onload=()=>{if(picture.complete&&picture.naturalWidth>0)finish(true);};
   picture.onerror=()=>{if(picture.complete&&picture.naturalWidth===0)finish(false);};
   probes.set(key,job);timer=setTimeout(()=>finish(false),8000);picture.src=requested;
   if(picture.complete)queueMicrotask(()=>{if(picture.naturalWidth>0)finish(true);else finish(false);});
  }
  changed();
 }
 function dispose(){
  if(disposed)return;disposed=true;
  for(const node of images())if(bindings.has(node)){node.onload=null;node.onerror=null;}
  for(const job of probes.values())job.clear();probes.clear();sources.clear();bindings=new WeakMap();
 }
 return{image,status,retry,dispose};
}
