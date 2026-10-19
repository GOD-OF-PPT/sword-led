import {createV3BrowserSession} from './application/v3-persistence.js';
import {mountV3} from './presentation-v3/app.js';
import './presentation-v3/styles.css';
const root=document.querySelector<HTMLElement>('#app');if(!root)throw Error('缺少游戏入口');
const app=mountV3(root,createV3BrowserSession(window));
if(import.meta.hot)import.meta.hot.dispose(()=>{void app.dispose();});
