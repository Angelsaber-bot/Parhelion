import * as T from 'three';
/** Isolated flat-floor diagnostic. No controller, root, clips or combat events owned.
 * Not production terrain support: targets use the observed native sole plane. */
export class IdleTurnCandidate {
 private chains:T.Object3D[][]=[];private originals:T.Quaternion[][]=[];private anchors:T.Vector3[]=[];private starts:T.Vector3[]=[];private native:T.Vector3[]=[];private swing:boolean[]=[];private modified=false;private previousP=new T.Vector3();private previousQ=new T.Quaternion();private initialized=false;private phase=0;private weight=0;private lastGroup=-1;
 readonly diagnostics={frames:0,maxReachError:0,maxFootError:0,maxSupportAdjustment:0};
 constructor(private root:T.Object3D,model:T.Object3D,private identity:string){
  const names=identity==='blackbeard'?['L','R'].map(s=>['Thigh','Shin','Foot'].map(p=>p+s)):identity==='napoleonMounted'?['L','R'].flatMap(s=>[['H_ForeUpper_'+s,'H_ForeCannon_'+s,'H_ForeHoof_'+s],['H_HindThigh_'+s,'H_HindShin_'+s,'H_HindCannon_'+s,'H_HindHoof_'+s]]):[];
  const chains=names.map(ns=>ns.map(n=>model.getObjectByName(n)));if(chains.some(c=>c.some(b=>!b)))return;this.chains=chains as T.Object3D[][];this.originals=this.chains.map(c=>c.map(b=>b.quaternion.clone()));this.anchors=this.chains.map(()=>new T.Vector3());this.starts=this.anchors.map(v=>v.clone());this.native=this.anchors.map(v=>v.clone());this.swing=this.anchors.map(()=>false);
 }
 restore(){if(!this.modified)return;this.chains.forEach((c,i)=>c.forEach((b,j)=>b.quaternion.copy(this.originals[i][j])));this.root.updateWorldMatrix(true,true);this.modified=false;}
 reset(){this.restore();this.initialized=false;this.phase=0;this.weight=0;this.lastGroup=-1;}
 apply(dt:number,state:string){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)return;this.root.updateWorldMatrix(true,true);const p=this.root.getWorldPosition(new T.Vector3()),q=this.root.getWorldQuaternion(new T.Quaternion());
  const active=this.initialized&&state==='idle'&&p.distanceTo(this.previousP)<.003&&q.angleTo(this.previousQ)<.3;const turn=active?q.angleTo(this.previousQ)/dt:0;
  if(!active){this.weight=0;this.phase=0;this.lastGroup=-1;}
  const turning=turn>.12;this.weight=T.MathUtils.clamp(this.weight+(turning?dt/.07:-dt/.18),0,1);
  this.chains.forEach((c,i)=>{this.native[i].copy(c[c.length-1].getWorldPosition(new T.Vector3()));if(!this.initialized||!active||this.weight===0)this.anchors[i].copy(this.native[i]);});
  this.previousP.copy(p);this.previousQ.copy(q);this.initialized=true;if(!active||!this.weight){this.phase=0;this.lastGroup=-1;this.swing.fill(false);return;}
  const duration=this.identity==='blackbeard'?.14:.12;this.phase+=dt;const group=Math.floor(this.phase/duration)%2,u=(this.phase%duration)/duration;
  if(group!==this.lastGroup){this.chains.forEach((c,i)=>{if(this.swing[i])this.anchors[i].copy(c[c.length-1].getWorldPosition(new T.Vector3()));this.starts[i].copy(this.anchors[i]);this.swing[i]=(this.identity==='blackbeard'?i:i===0||i===3?0:1)===group;});this.lastGroup=group;}
  this.chains.forEach((chain,i)=>{
   chain.forEach((bone,j)=>this.originals[i][j].copy(bone.quaternion));const target=this.anchors[i].clone();if(this.swing[i]){const smooth=u*u*(3-2*u);target.copy(this.starts[i]).lerp(this.native[i],smooth);target.y+=Math.sin(Math.PI*u)*(this.identity==='blackbeard'?.085:.055);}
   const last=chain[chain.length-1],footQ=last.getWorldQuaternion(new T.Quaternion()),endpoint=chain[2],endpointQ=endpoint.getWorldQuaternion(new T.Quaternion());const endTarget=target.clone();if(chain.length===4)endTarget.sub(last.getWorldPosition(new T.Vector3()).sub(endpoint.getWorldPosition(new T.Vector3())));
   // Nearly straight legs accommodate old anchors on their reachable plane;
   // measured residual sliding, never leg stretch or a claim of perfect locking.
   const hip=chain[0].getWorldPosition(new T.Vector3()),mid=chain[1].getWorldPosition(new T.Vector3()),end=endpoint.getWorldPosition(new T.Vector3()),reach=hip.distanceTo(mid)+mid.distanceTo(end)-.00001,dy=endTarget.y-hip.y,radial=new T.Vector3(endTarget.x-hip.x,0,endTarget.z-hip.z),radius=Math.sqrt(Math.max(0,reach*reach-dy*dy));
   if(Math.abs(dy)<reach&&radial.length()>radius){const before=endTarget.clone();radial.setLength(radius);endTarget.x=hip.x+radial.x;endTarget.z=hip.z+radial.z;const adjust=endTarget.clone().sub(before);target.add(adjust);if(!this.swing[i])this.anchors[i].add(adjust);this.diagnostics.maxSupportAdjustment=Math.max(this.diagnostics.maxSupportAdjustment,adjust.length());}
   this.solve(chain[0],chain[1],endpoint,endTarget);if(chain.length===4)this.worldQ(endpoint,endpointQ);this.worldQ(last,footQ);this.diagnostics.maxFootError=Math.max(this.diagnostics.maxFootError,last.getWorldPosition(new T.Vector3()).distanceTo(target));chain.forEach((bone,j)=>bone.quaternion.slerpQuaternions(this.originals[i][j],bone.quaternion.clone(),this.weight));chain[0].updateWorldMatrix(false,true);
  });this.modified=true;this.diagnostics.frames++;
 }
 private worldQ(b:T.Object3D,q:T.Quaternion){b.quaternion.copy(b.parent!.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));b.updateWorldMatrix(false,true);}
 private aim(b:T.Object3D,child:T.Object3D,dir:T.Vector3){const from=child.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize();this.worldQ(b,new T.Quaternion().setFromUnitVectors(from,dir.normalize()).multiply(b.getWorldQuaternion(new T.Quaternion())));}
 private solve(a:T.Object3D,b:T.Object3D,c:T.Object3D,target:T.Vector3){const hip=a.getWorldPosition(new T.Vector3()),knee=b.getWorldPosition(new T.Vector3()),foot=c.getWorldPosition(new T.Vector3()),l1=hip.distanceTo(knee),l2=knee.distanceTo(foot),axis=target.clone().sub(hip),raw=axis.length(),d=T.MathUtils.clamp(raw,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);axis.normalize();this.diagnostics.maxReachError=Math.max(this.diagnostics.maxReachError,Math.abs(raw-d));const pole=knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis));if(pole.lengthSq()<1e-8)pole.set(0,0,1).applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion())).addScaledVector(axis,-pole.dot(axis));pole.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along)),joint=hip.clone().addScaledVector(axis,along).addScaledVector(pole,height);this.aim(a,b,joint.clone().sub(hip));this.aim(b,c,hip.addScaledVector(axis,d).sub(joint));}
}
