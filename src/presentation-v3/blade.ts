import type {Blade} from '../core-v3/index.js';
export function paintBlade(canvas:HTMLCanvasElement,blade:Blade|null,texture?:HTMLImageElement){
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
  const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const c=canvas.getContext('2d');if(!c)return;c.scale(canvas.width/1100,canvas.height/400);c.clearRect(0,0,1100,400);
  if(!blade)return;
  const stage=Math.min(5,Math.floor(blade.level/3)),lift=stage*6,end=blade.status==='broken'?650:1020;
  c.save();c.shadowColor='#000';c.shadowBlur=24;c.fillStyle='#0a1113bb';c.beginPath();c.ellipse(590,310,450,22,0,0,Math.PI*2);c.fill();c.restore();
  c.fillStyle='#4b2b20';c.strokeStyle='#ba8850';c.lineWidth=3;c.fillRect(32,223,170,38);c.strokeRect(32,223,170,38);
  for(let x=40;x<195;x+=17){c.strokeStyle='#c0a175';c.beginPath();c.moveTo(x,224);c.lineTo(x-12,260);c.stroke();}
  c.fillStyle='#d6ab5f';c.beginPath();c.roundRect(190,204,24,78,5);c.fill();
  const path=new Path2D();path.moveTo(211,218-lift);path.lineTo(end-90,217-lift);path.quadraticCurveTo(end-20,206-lift,end,188-lift);path.lineTo(end-38,263);path.quadraticCurveTo(640,302+lift,212,263);path.closePath();
  const metal=c.createLinearGradient(0,190,0,295);metal.addColorStop(0,'#d5e1de');metal.addColorStop(.3,'#475b69');metal.addColorStop(.55,'#293c4b');metal.addColorStop(.83,blade.level>0?'#e58c42':'#9aa6a6');metal.addColorStop(1,blade.level>0?'#ffd8a0':'#ded9c6');
  c.fillStyle=metal;c.strokeStyle='#dccb9b';c.lineWidth=3;c.fill(path);c.stroke(path);
  c.save();c.clip(path);if(texture){c.globalAlpha=.3;c.globalCompositeOperation='soft-light';c.drawImage(texture,210,155,830,160);c.globalAlpha=1;c.globalCompositeOperation='source-over';}
  c.strokeStyle=blade.level>0?'#ffbc65':'#607785';c.lineWidth=2;c.shadowColor='#f07826';c.shadowBlur=blade.level>0?12:0;
  for(let i=0;i<stage+1;i++){c.beginPath();c.moveTo(220,258-i*4);for(let x=240;x<1040;x+=24)c.lineTo(x,257-i*5+Math.sin(x*.027+i)*5);c.stroke();}
  if(blade.cracked||blade.status==='broken'){c.shadowBlur=0;c.strokeStyle='#171717';c.lineWidth=5;c.beginPath();c.moveTo(490,202-lift);c.lineTo(515,229);c.lineTo(501,238);c.lineTo(539,265);c.lineTo(531,297);c.stroke();c.strokeStyle='#ffa44b';c.lineWidth=1;c.stroke();}
  c.restore();
  if(blade.status==='broken'){c.fillStyle='#68727a';c.beginPath();c.moveTo(738,279);c.lineTo(920,266);c.lineTo(823,301);c.lineTo(751,304);c.closePath();c.fill();}
}
