/** Actual production settings DOM snapshots. Fixture save flags, no browser/GPU image. */
import {mkdir,writeFile} from 'node:fs/promises';import {bootWorldWithoutGpu} from '../world-dom-boot.fixture';
const out='../artifacts/weapon-finish-ui';await mkdir(out,{recursive:true});
for(const [name,done,preference] of [
 ['locked',[], 'original'],['earned',['campaign_alpha_complete','campaign_britain_complete','campaign_blacksail_complete','campaign_winter_complete','campaign_kyoto_complete'],'oath'],['reset-retains-preference',[],'oath']
]as const){
 const h=await bootWorldWithoutGpu({deterministic:true,initialStorage:{'parhelion.world.progress.v2':JSON.stringify({done,found:[]}),'parhelion.world.weapon.finish.v1':JSON.stringify({version:1,finish:preference})}});
 try{const w=h.world,d=h.window.document;w.settingsPanel.show();w.weaponFinishControl.refresh();const select=d.getElementById('world-weapon-finish')as HTMLSelectElement;
 // Reflect select's live property in the read-only static DOM serialization.
 for(const option of select.options)option.toggleAttribute('selected',option.value===select.value);
 (d.querySelector('#world-weapon-finishes details')as HTMLDetailsElement).open=true;
 await writeFile(`${out}/${name}.html`,await h.snapshot(`Journey finishes: ${name}`));await writeFile(`${out}/${name}.json`,JSON.stringify({evidence:'Actual main DOM; synthetic save fixtures, no WebGL image',preference:w.weaponFinishStore.preference,active:w.weaponFinishStore.active(w.done),options:Array.from(select.options,o=>({value:o.value,disabled:o.disabled,selected:o.selected,text:o.textContent})),text:d.getElementById('world-weapon-finishes')!.textContent},null,2));
 }finally{await h.close();}
}
