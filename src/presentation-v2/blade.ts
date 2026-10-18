import type { Workpiece } from '../core-v2/index.js';
import { statAt } from '../core-v2/rules.js';

export const NODE_X=[160,300,440,580,720] as const;
export const nodeY = (node: number) => node < 5 ? 212 : 128;
const colours={iron:'#8c9ca5',steel:'#b6d5e0',meteorite:'#a29dd5'};
/** Saved section work changes the silhouette; generated texture is clipped inside that geometry. */
export function paintBlade(canvas:HTMLCanvasElement,piece:Workpiece,selected:number,texture?:HTMLImageElement){
  const box=canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(box.width*ratio)),h=Math.max(1,Math.round(box.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(w/1000,0,0,h/340,0,0);c.clearRect(0,0,1000,340);
  const widths=NODE_X.map((_,i)=>([55,64,70,64,55][i]??55)+((piece.nodes[i+5]??0)-(piece.nodes[i]??0))*1.4);
  const path=new Path2D();path.moveTo(40,174);
  for(let i=0;i<5;i++)path.lineTo(NODE_X[i]??0,170-(widths[i]??30));
  path.lineTo(800,139);path.lineTo(800,201);
  for(let i=4;i>=0;i--)path.lineTo(NODE_X[i]??0,170+(widths[i]??30));path.closePath();
  c.save();c.shadowColor='#080d19';c.shadowBlur=12;c.shadowOffsetY=8;c.fillStyle=colours[piece.material];c.fill(path);c.restore();
  c.save();c.clip(path);
  if(texture){const i=piece.material==='iron'?0:piece.material==='steel'?1:2,sw=texture.naturalWidth/3;c.drawImage(texture,i*sw,0,sw,texture.naturalHeight,40,105,765,135);}
  const glow=piece.quench===null?Math.min(1,piece.heat/100):0;const metal=c.createLinearGradient(0,110,0,230);metal.addColorStop(0,'#bccfdb77');metal.addColorStop(.42,'#19243940');metal.addColorStop(.65,`rgba(236,100,36,${.78*glow})`);metal.addColorStop(1,glow>.2?`rgba(255,172,75,${glow})`:'#8ab2c355');
  c.fillStyle=metal;c.fillRect(35,100,780,150);
  // Fixed brush marks are cosmetic, with no random or wall-clock dependency.
  for(let i=0;i<55;i++){const x=58+(i*97)%724,y=126+(i*29)%85;c.strokeStyle=i%3?'#15223465':'#b5c1bf66';c.lineWidth=i%4+1;c.beginPath();c.moveTo(x,y);c.lineTo(x+13,y-3);c.lineTo(x+20,y+2);c.stroke();}
  c.restore();c.strokeStyle='#151b29';c.lineWidth=6;c.stroke(path);
  c.strokeStyle=piece.quench===null&&piece.heat>20?'#ffc478':'#e3e5cd';c.lineWidth=4;c.beginPath();c.moveTo(40,174);for(let i=0;i<5;i++)c.lineTo(NODE_X[i]??0,170+(widths[i]??30)-4);c.lineTo(800,197);c.stroke();
  // One guard, one wrapped grip and one pommel opposite the only pointed tip.
  c.fillStyle='#b38c52';c.strokeStyle='#182031';c.lineWidth=5;c.beginPath();c.moveTo(800,113);c.lineTo(816,119);c.lineTo(822,218);c.lineTo(803,227);c.closePath();c.fill();c.stroke();
  c.fillStyle=piece.material==='meteorite'?'#50405f':'#714d3b';c.beginPath();c.moveTo(817,153);c.lineTo(925,157);c.lineTo(925,184);c.lineTo(818,188);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#b39265';c.lineWidth=3;for(let x=829;x<921;x+=15){c.beginPath();c.moveTo(x,157);c.lineTo(x-7,183);c.stroke();}
  c.fillStyle='#b99459';c.strokeStyle='#19202d';c.beginPath();c.ellipse(935,170,15,20,0,0,Math.PI*2);c.fill();c.stroke();
  // Glow paths are craft marks; dark jagged faults are lost integrity.
  for(const trace of piece.traces){c.beginPath();for(const[i,n]of trace.nodes.entries()){const x=NODE_X[n%5]??0,y=nodeY(n);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle=trace.rewarded?'#ffc778':'#a6bec0';c.lineWidth=trace.rewarded?4:2;c.stroke();}
  if(piece.integrity<piece.maxIntegrity){c.strokeStyle='#101725';c.lineWidth=5;for(let i=0;i<piece.maxIntegrity-piece.integrity;i++){const x=220+i*130;c.beginPath();c.moveTo(x,138);c.lineTo(x-9,165);c.lineTo(x+10,185);c.lineTo(x,205);c.stroke();}}
  if(piece.status==='broken'){c.save();c.globalCompositeOperation='destination-out';c.lineWidth=25;c.beginPath();c.moveTo(495,109);c.lineTo(480,180);c.lineTo(505,235);c.stroke();c.restore();}
  for(let n=0;n<10;n++){const x=NODE_X[n%5]??0,y=nodeY(n);c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle=n===selected?'#ffe5a5':statAt(n)==='edge'?'#bf725d':statAt(n)==='toughness'?'#87b8cc':'#9cbfa1';c.strokeStyle='#202233';c.lineWidth=3;c.fillRect(-8,-8,16,16);c.strokeRect(-8,-8,16,16);c.restore();}
}
