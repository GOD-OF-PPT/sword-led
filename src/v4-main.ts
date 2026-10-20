import {createV4BrowserSession} from './application/v4-persistence.js';
import {mountV4} from './presentation-v4/app.js';
import './presentation-v4/styles.css';
import './presentation-v4/forge.css';
const root=document.querySelector<HTMLElement>('#app');
if(!root)throw Error('缺少灯炉入口');
const app=mountV4(root,createV4BrowserSession(window));
if(import.meta.hot)import.meta.hot.dispose(()=>{void app.dispose();});
