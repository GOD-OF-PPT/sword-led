import type { Workpiece } from '../core-v2/index.js';
import { statAt } from '../core-v2/rules.js';

export const NODE_X=[160,300,440,580,720] as const;
const colours={iron:'#a7adb1',steel:'#bed3dc',meteorite:'#9197c8'};
/** Geometry is the saved five-section work, not a decorative random sword sprite. */
export function paintBlade(canvas:HTMLCanvasElement,piece:Workpiece,selected:number){
  const box=canvas.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1),w=Math.max(1,Math.round(box.width*ratio)),h=Math.max(1,Math.round(box.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(w/1000,0,0,h/340,0,0);c.clearRect(0,0,1000,340);
  c.fillStyle='#263343';c.fillRect(0,0,1000,340);c.fillStyle='#473c3d';c.fillRect(45,235,875,25);c.fillStyle='#202a36';c.fillRect(115,260,690,25);
  const widths=NODE_X.map((_,i)=>([35,47,53,47,35][i]??35)+((piece.nodes[i+5]??0)-(piece.nodes[i]??0))*2);
  c.beginPath();c.moveTo(40,170);for(let i=0;i<5;i++)c.lineTo(NODE_X[i]??0,170-(widths[i]??30));c.lineTo(800,140);c.lineTo(800,200);
  for(let i=4;i>=0;i--)c.lineTo(NODE_X[i]??0,170+(widths[i]??30));c.closePath();
  const metal=c.createLinearGradient(0,110,0,230);metal.addColorStop(0,colours[piece.material]);metal.addColorStop(.48,'#65717c');metal.addColorStop(.52,'#d1ccba');metal.addColorStop(1,piece.quench===null&&piece.heat>20?'#e69758':'#728b99');
  c.fillStyle=metal;c.fill();c.strokeStyle='#1d252e';c.lineWidth=6;c.stroke();
  c.strokeStyle=piece.quench===null&&piece.heat>20?'#f6ad67':'#d4d6cc';c.lineWidth=4;c.beginPath();c.moveTo(40,170);for(let i=0;i<5;i++)c.lineTo(NODE_X[i]??0,170+(widths[i]??30)-5);c.lineTo(800,195);c.stroke();
  // One guard, one grip and one pommel at the opposite end from the single tip.
  c.fillStyle='#c49a57';c.fillRect(802,115,15,110);c.fillStyle='#7f4e3e';c.fillRect(817,153,105,34);c.strokeStyle='#322838';c.lineWidth=4;c.strokeRect(817,153,105,34);
  c.strokeStyle='#c89a64';for(let x=827;x<920;x+=15){c.beginPath();c.moveTo(x,156);c.lineTo(x-7,184);c.stroke();}c.fillStyle='#bc9a60';c.beginPath();c.arc(935,170,17,0,Math.PI*2);c.fill();
  for(const trace of piece.traces){c.beginPath();for(const[i,n]of trace.nodes.entries()){const x=NODE_X[n%5]??0,y=n<5?208:132;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.strokeStyle=trace.rewarded?'#f1bf6c':'#7e8a8c';c.lineWidth=trace.rewarded?4:2;c.stroke();}
  if(piece.integrity<piece.maxIntegrity){c.strokeStyle='#241e29';c.lineWidth=5;for(let i=0;i<piece.maxIntegrity-piece.integrity;i++){const x=220+i*130;c.beginPath();c.moveTo(x,138);c.lineTo(x-9,165);c.lineTo(x+10,185);c.lineTo(x,205);c.stroke();}}
  if(piece.status==='broken'){c.strokeStyle='#263343';c.lineWidth=28;c.beginPath();c.moveTo(495,112);c.lineTo(480,180);c.lineTo(505,230);c.stroke();}
  c.font='17px system-ui';c.textAlign='center';for(let n=0;n<10;n++){const x=NODE_X[n%5]??0,y=n<5?208:132;c.beginPath();c.arc(x,y,11,0,Math.PI*2);c.fillStyle=n===selected?'#f4b55f':statAt(n)==='edge'?'#be6953':statAt(n)==='toughness'?'#77a3b7':'#90baa3';c.fill();c.strokeStyle='#2b2736';c.lineWidth=3;c.stroke();}
}
