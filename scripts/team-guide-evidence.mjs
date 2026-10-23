// Small teaching fixtures from the actual production worker, without overwriting
// the dated runtime-proof.json used by the final academic report.
import { Worker } from 'node:worker_threads';
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const asset = (await readdir('dist/assets')).find(s => /^worker-.*\.js$/.test(s));
const worker = new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};import(${JSON.stringify(pathToFileURL(path.resolve('dist/assets',asset)).href)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
let id=0;
function send(task,data){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker timeout')),12000);worker.once('message',out=>{clearTimeout(timer);out.error?reject(new Error(out.error.message)):resolve(out.result);});worker.postMessage({id:++id,task,data});});}
const data={name:'Teaching example',input:'inspect --tag "sample data"',rules:[{name:'Long flag',pattern:'--[a-z]+'}],mode:'whole',left:'ab*',right:'a'};
try{
  const regular=await send('compile',data),simple=await send('analyse',data),comparison=await send('compare',{...data,left:'--[a-z]+',right:'--[a-z][a-z]+'});
  await mkdir('../output/evidence',{recursive:true});
  await writeFile('../output/evidence/team-guide-examples.json',JSON.stringify({verifiedAt:new Date().toISOString(),transport:'Actual production worker under Node worker_threads',regular,simple,comparison},null,2));
  console.log(JSON.stringify({pattern:regular.pattern,nfa:regular.nfa.stateCount,dfa:regular.dfa.stateCount,minimal:regular.minimal.stateCount,subsets:regular.dfa.members,minimalBlocks:regular.minimal.members,closures:regular.closures,simpleParserActions:simple.parse.trace.length,simpleTokens:simple.lex.tokens,edges:regular.nfa.edges}));
}finally{await worker.terminate();}
