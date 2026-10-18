import { createBrowserSession } from './persistence/index.js';
import { mountGame } from './presentation/app.js';
import './presentation/styles.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('缺少游戏入口');
const app = mountGame(root, createBrowserSession(window));
if (import.meta.hot) import.meta.hot.dispose(() => { void app.dispose(); });
