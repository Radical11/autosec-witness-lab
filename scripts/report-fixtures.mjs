// Reproducible evidence from the actual built worker; no browser or UI substitutes.
import { Worker } from 'node:worker_threads';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const assets = await readdir('dist/assets');
const asset = assets.find(s => /^worker-.*\.js$/.test(s));
if (!asset) throw new Error('Build before collecting report fixtures.');
const source = pathToFileURL(path.resolve('dist/assets', asset)).href;
const worker = new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};import(${JSON.stringify(source)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`, { eval: true });
await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
let id = 0;
const send = (task, data) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Worker timeout')), 12000);
  worker.once('message', out => { clearTimeout(timer); out.error ? reject(new Error(out.error.message)) : resolve(out.result); });
  worker.postMessage({ id: ++id, task, data });
});
const base = { name:'Paper fixture', input:'inspect --tag sample; (scan file)', rules:[{name:'Flag',pattern:'--[a-z]+'}], left:'--[a-z]+', right:'--[a-z][a-z]+', mode:'whole' };
try {
  const inputs = [base.input, 'inspect --tag', 'inspect --tag sample; (scan file', 'inspect file', '(inspect file', 'inspect "--tag"', 'inspect file;', 'inspect @'];
  const cases = [];
  for (const input of inputs) cases.push(await send('analyse', {...base,input}));
  const flag = await send('compile', base);
  const regular = await send('compile', {...base,left:'ab*'});
  const comparison = await send('compare', base);
  const equivalent = await send('compare', {...base,left:'a+',right:'aa*'});
  const empty = await send('compare', {...base,left:'a*',right:'a+'});
  assert(cases[0].structureAccepted && cases[0].patternMatched);
  assert(!cases[1].structureAccepted && cases[1].patternMatched);
  assert(!cases[2].structureAccepted && cases[2].patternMatched);
  assert.equal(comparison.comparison.witness,'--a');
  assert(comparison.comparison.leftAccepted && !comparison.comparison.rightAccepted);
  assert(equivalent.comparison.equivalent);
  assert.equal(empty.comparison.witness,'');
  const proof = { verifiedAt:new Date().toISOString(), transport:'Built browser worker executed under Node worker_threads, not a browser timing benchmark', node:process.version, workerAsset:asset, workerSha256:createHash('sha256').update(await readFile('dist/assets/'+asset)).digest('hex'), cases, flag, regular, comparison, equivalent:equivalent.comparison, empty:empty.comparison };
  await mkdir('../output/evidence',{recursive:true});
  await writeFile('../output/evidence/report-fixtures-2026-10-24.json',JSON.stringify(proof,null,2));
  console.log(JSON.stringify({cases:cases.map(c=>({input:c.input,tokens:c.lex.tokens.length,actions:c.parse?.trace.length,pattern:c.patternMatched,syntax:c.structureAccepted,error:c.lex.error??c.parse?.error})), flagCounts:[flag.nfa.stateCount,flag.dfa.stateCount,flag.minimal.stateCount], abStar:[regular.nfa.stateCount,regular.dfa.stateCount,regular.minimal.stateCount],comparison:comparison.comparison}));
} finally { await worker.terminate(); }
