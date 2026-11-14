import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const isQA=pathname==='/__qa';
    const file=isQA?fileURLToPath(new URL('../tests/browser.html',import.meta.url)):resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!isQA&&!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(body);
  }catch(error){res.writeHead(error instanceof URIError?400:404).end(error instanceof URIError?'Bad request':'Not found');}
});
const port=Number(process.env.PORT)||4173;
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
