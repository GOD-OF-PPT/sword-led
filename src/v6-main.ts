import {createV6BrowserSession} from './application/v6-persistence.js';
import {mountV6} from './presentation-v6/app.js';
import './presentation-v6/styles.css';
const root=document.querySelector<HTMLElement>('#app');
if(!root)throw Error('缺少开路入口');
const app=mountV6(root,createV6BrowserSession(window));
if(import.meta.hot)import.meta.hot.dispose(()=>{void app.dispose();});
