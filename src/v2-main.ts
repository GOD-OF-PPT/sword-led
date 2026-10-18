import { createV2BrowserSession } from './application/v2-persistence.js';
import { mountV2 } from './presentation-v2/app.js';
import './presentation-v2/styles.css';
import './presentation-v2/d.css';
const root=document.querySelector<HTMLElement>('#app');if(!root)throw Error('缺少游戏入口');
const app=mountV2(root,createV2BrowserSession(window));
if(import.meta.hot)import.meta.hot.dispose(()=>{void app.dispose();});
