import {createV5BrowserSession} from '../../../src/application/v5-persistence.js';
import {mountV5} from '../../../src/presentation-v5/app.js';
import '../../../src/presentation-v4/styles.css';
import '../../../src/presentation-v4/forge.css';
import '../../../src/presentation-v4/journey.css';
import '../../../src/presentation-v4/collection.css';
import '../../../src/presentation-v5/economy.css';
import '../../../src/presentation-v5/market-stall.css';
import '../../../src/presentation-v5/growth.css';
import '../../../src/presentation-v5/readability.css';

/** Test-only entry. It exposes the real view lifecycle, and no economic operation. */
declare global {interface Window {t03Lifecycle:{mount():void;dispose():Promise<void>}}}
let mounted:ReturnType<typeof mountV5>|null=null;
window.t03Lifecycle={
 mount(){
  if(mounted)throw Error('Dispose the previous real mount before mounting again');
  const root=document.querySelector<HTMLElement>('#app');if(!root)throw Error('Missing lifecycle root');
  mounted=mountV5(root,createV5BrowserSession(window));
 },
 async dispose(){const previous=mounted;mounted=null;if(previous)await previous.dispose();},
};
