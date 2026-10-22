// UNEXECUTED candidate. Run only through the separately frozen comparator config.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);if(index<0||!args[index+1])throw Error('Missing '+name);return args[index+1];};
const root=resolve(value('--root')),port=Number(value('--port'));if(!Number.isSafeInteger(port)||port<1024)throw Error('Invalid isolated port');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
createServer(async(request,response)=>{
 try{const path=decodeURIComponent(new URL(request.url??'/','http://127.0.0.1').pathname),file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(file!==root&&!file.startsWith(root+sep)){response.writeHead(403);response.end();return;}
  if(!(await stat(file)).isFile()){response.writeHead(404);response.end();return;}
  const bytes=await readFile(file);response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});response.end(bytes);
 }catch{response.writeHead(404);response.end();}
}).listen(port,'127.0.0.1',()=>process.stdout.write('Canvas snapshot ready http://127.0.0.1:'+port+' root='+root+'\n'));
