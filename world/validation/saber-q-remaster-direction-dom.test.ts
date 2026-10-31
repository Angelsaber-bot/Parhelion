import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,readFileSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';
test('actual-main Saber Q cardinal/moving/LOS/height/fallback and locked-target invalidation matrix',()=>{
 const output=join(mkdtempSync(join(tmpdir(),'parhelion-saber-q-')),'result.json');
 const run=spawnSync(process.execPath,['--import','tsx',resolve('validation/remaster-review/saber-q-direction.ts'),resolve(process.env.WORLD_SOURCE_QA_ROOT??'.'),output],{cwd:process.cwd(),encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(run.status,0,run.stderr+'\n'+run.stdout);const report=JSON.parse(readFileSync(output,'utf8'));assert.equal(report.error,null);assert.ok(report.rows.length>=12);assert.ok(report.rows.every((r:any)=>r.passed));
});
