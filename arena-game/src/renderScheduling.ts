/** A modal owns the GPU while it covers the arena; preserve the last world frame. */
export function worldRenderVisible(doc:Pick<Document,'visibilityState'|'getElementById'>){
 return doc.visibilityState!=='hidden'&&!['armory-dialog','arena-settings'].some(id=>(doc.getElementById(id)as HTMLDialogElement|null)?.open);
}
export class FrameGate{
 private last=-Infinity;
 constructor(private fps:number){}
 allow(now:number){if(now-this.last<1000/this.fps-.1)return false;this.last=now;return true;}
}
