import test from 'node:test';import assert from 'node:assert/strict';import {BootWorkBudget} from '../src/bootScheduling.ts';
test('loading yields only at budget or explicit stage boundaries and resumes original work',async()=>{
 let now=0,called=0;const b=new BootWorkBudget(12,()=>now,async()=>{called++});await b.checkpoint();assert.equal(called,0);now=11;await b.checkpoint();assert.equal(called,0);now=12;await b.checkpoint();assert.equal(called,1);await b.checkpoint();assert.equal(called,1);await b.checkpoint(true);assert.equal(called,2);assert.equal(b.yields,2);
});
