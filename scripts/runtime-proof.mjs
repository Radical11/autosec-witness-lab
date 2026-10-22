// Executes the actual production Web Worker bundle using Node's worker transport.
// This verifies engine integration and serialization, not a browser rendering session.
import { Worker } from "node:worker_threads";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
const asset = (await readdir("dist/assets")).find((s) =>
  /^worker-.*\.js$/.test(s),
);
if (!asset) throw new Error("Build first. No production worker was found.");
const worker = new Worker(
  `const {parentPort} = require('node:worker_threads'); global.self = { postMessage: data => parentPort.postMessage(data) }; import(${JSON.stringify(pathToFileURL(path.resolve("dist/assets", asset)).href)}).then(() => { parentPort.on('message', data => self.onmessage({data})); parentPort.postMessage({ready:true}); });`,
  { eval: true },
);
await new Promise((resolve, reject) => {
  worker.once("message", resolve);
  worker.once("error", reject);
});
let id = 0;
const send = (task, data) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Worker timed out")),
      12000,
    );
    worker.once("message", (out) => {
      clearTimeout(timer);
      if (out.error) reject(new Error(out.error.message));
      else resolve(out.result);
    });
    worker.postMessage({ id: ++id, task, data });
  });
const rules = [
  { name: "Long flag", pattern: "--[a-z]+" },
  { name: "Statement separator", pattern: ";" },
  { name: "Parent traversal", pattern: "\\.\\./" },
];
const data = {
  name: "Production worker proof",
  input: 'inspect --tag "sample data"; (check file; scan --mode quick)',
  rules,
  left: "--[a-z]+",
  right: "--[a-z][a-z]+",
  mode: "whole",
};
try {
  const start = performance.now(),
    analysis = await send("analyse", data),
    compared = await send("compare", data),
    equivalent = await send("compare", { ...data, left: "a+", right: "aa*" });
  if (
    !analysis.structureAccepted ||
    !analysis.patternMatched ||
    compared.comparison.witness !== "--a" ||
    !equivalent.comparison.equivalent
  )
    throw new Error("Production worker integration mismatch.");
  const fixtures = [];
  for (const [name, input] of [
    ["missing-value", "inspect --tag"],
    ["plain-command", "inspect file"],
    ["broken-structure", "(inspect file"],
  ])
    fixtures.push({ name, result: await send("analyse", { ...data, input }) });
  const proof = {
    verifiedAt: new Date().toISOString(),
    runtime: process.version,
    transport:
      "Node worker_threads executing the unmodified production Web Worker bundle",
    browserVerified: false,
    milliseconds: +(performance.now() - start).toFixed(2),
    bundle: asset,
    analysis,
    compared,
    equivalent: equivalent.comparison,
    fixtures,
  };
  await mkdir("../output/evidence", { recursive: true });
  await writeFile(
    "../output/evidence/runtime-proof.json",
    JSON.stringify(proof, null, 2),
  );
  console.log(
    JSON.stringify({
      passed: true,
      witness: compared.comparison.witness,
      tokens: analysis.lex.tokens.length,
      parserActions: analysis.parse.trace.length,
      equivalent: equivalent.comparison.equivalent,
      milliseconds: proof.milliseconds,
    }),
  );
} finally {
  await worker.terminate();
}
