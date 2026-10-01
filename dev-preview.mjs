// Opt-in loopback preview. Only local snapshot files are used; cloud records are never contacted.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
export function localLedgerPreview(){return {name:'local-ledger-preview',configureServer(server){
 server.middlewares.use(async(req,res,next)=>{
  if(!req.url?.startsWith('/api/'))return next();
  const allowed=new Set(['127.0.0.1:3000','localhost:3000']);
  if(!allowed.has(req.headers.host)){res.writeHead(403).end('Local access only');return;}
  const filepath='.sites-runtime/preview-ledger.json';
  mkdirSync('.sites-runtime',{recursive:true});
  const data=existsSync(filepath)?JSON.parse(readFileSync(filepath,'utf8')):{revision:0,values:{},sourceDate:null};
  const reply=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({...value,mode:'local-preview',sourceDate:data.sourceDate}));};
  if(req.url.startsWith('/api/backup')&&req.method==='GET')return reply(data);
  if(req.url!=='/api/ledger')return reply({error:'Receipt unavailable in this local snapshot.'},404);
  if(req.method==='GET')return reply(data);
  if(req.method!=='PUT')return reply({error:'Method not allowed'},405);
  if(!['http://127.0.0.1:3000','http://localhost:3000'].includes(req.headers.origin))return reply({error:'Invalid origin'},403);
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>21000000)return reply({error:'Snapshot too large'},413);}
  try {const body=JSON.parse(raw);if(body.revision!==data.revision)return reply({error:'Newer local snapshot exists.'},409);if(!body.values||Array.isArray(body.values)||typeof body.values!=='object'||Object.values(body.values).some(v=>typeof v!=='string'))return reply({error:'Invalid records'},400);const saved={revision:data.revision+1,values:body.values,mode:'local-preview',sourceDate:data.sourceDate};const backup=`.sites-runtime/local-backup-${data.revision}.json`;if(!existsSync(backup))writeFileSync(backup,JSON.stringify(data,null,2));writeFileSync(filepath,JSON.stringify(saved,null,2));return reply(saved);}catch{return reply({error:'Invalid request'},400);}
 });
}};}
