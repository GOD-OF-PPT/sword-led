import './v8/styles.css';
import { V8_REPO_ASSETS } from './v8/assets.js';
import { mountV8App } from './v8/v8-app.mjs';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('缺少护炉远行 V8 参赛版入口');
const app = mountV8App(root, V8_REPO_ASSETS, { showClassicLink: true });
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.dispose();
  });
}
