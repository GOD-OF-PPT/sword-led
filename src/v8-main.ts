import './v8/styles.css';
import { V8_REPO_ART_MAP } from './v8/assets';
import { mountV8App } from './v8/v8-app.mjs';

const appRoot = document.querySelector<HTMLElement>('#app');
if (appRoot) {
  const app = mountV8App(appRoot, V8_REPO_ART_MAP, { showClassicLink: true });
  if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
}
