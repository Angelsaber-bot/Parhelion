import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Batch } from '../tools/gen/geo.ts';
import { addMachiyaCraft, addCityBlock, addKyotoRoof } from '../tools/gen/kyoto/architecture.ts';

// Compare translation-normalized vertex geometry, not labels, colors, or position alone.
function fingerprint(b:Batch,x=0,z=0){
 const data:number[]=[];
 for(const g of b.vis){const p=g.attributes.position;for(let i=0;i<p.count;i++)data.push(Math.round((p.getX(i)-x)*1000),Math.round(p.getY(i)*1000),Math.round((p.getZ(i)-z)*1000));}
 return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
test('Kyoto machiya trades have eight genuinely different deterministic geometric frontages',()=>{
 const styles=new Map<number,string>();
 for(let x=0;x<8;x++){
  const b=new Batch('qa'),style=addMachiyaCraft(b,x,4,0,0,6,8,6);
  assert.equal(b.col.length,0,'frontage craft does not add invisible navigation blockers');
  assert.ok(b.vis.length>45,'actual detailed framing and trade props');
  styles.set(style,fingerprint(b,x));
  const again=new Batch('qa');assert.equal(addMachiyaCraft(again,x,4,0,0,6,8,6),style);
  assert.equal(fingerprint(again,x),fingerprint(b,x),'deterministic geometry');
 }
 assert.equal(styles.size,8);assert.equal(new Set(styles.values()).size,8,'variation must not be only color or location');
});
test('Kyoto city compounds have distinct market, courtyard, shrine and workshop geometry',()=>{
 const prints=[];
 for(let kind=0;kind<4;kind++){const b=new Batch('qa');addCityBlock(b,0,4,0,20,20,kind);prints.push(fingerprint(b));assert.ok(b.vis.length>35);}
 assert.equal(new Set(prints).size,4);
});
test('Kyoto roof craft contains curved multi-level eaves and no duplicate collision shell',()=>{
 const b=new Batch('qa');addKyotoRoof(b,0,10,0,0,14,10,3,'#62666a','hip');
 assert.equal(b.col.length,0);assert.ok(b.vis.length>25,'fascia, ridge, rafters and caps exist');
 const y=new Set<number>();for(const g of b.vis)for(let i=0;i<g.attributes.position.count;i++)y.add(Math.round(g.attributes.position.getY(i)*100));
 assert.ok(y.size>20,'roof has curved multi-break profile, not the previous four-triangle pyramid');
});
