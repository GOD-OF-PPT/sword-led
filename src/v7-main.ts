import {createV7BrowserSession} from './application/v7-persistence.js';
import {mountCampaign} from './presentation-v7/app.js';
import './presentation-v7/styles.css';
const root=document.querySelector<HTMLElement>('#app');
if(!root)throw Error('缺少护炉远行入口');
const app=mountCampaign(root,createV7BrowserSession(window));
if(import.meta.hot)import.meta.hot.dispose(()=>{void app.dispose();});
