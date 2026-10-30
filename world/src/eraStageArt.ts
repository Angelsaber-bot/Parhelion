import * as THREE from 'three';
import { radialGeometry } from './saberStageArt';
export interface EraArtFrame { phase: 'intro'|'charge'|'release'|'outro'; elapsed: number; progress: number; pulse: number; strikeCount?: number; }
export interface EraArtOwner {
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh;
  material(color: number, opacity: number): THREE.MeshBasicMaterial;
}
interface Salvo { age: number; enabled: boolean[]; flashes: THREE.Mesh[]; smoke: THREE.Mesh[]; traces: THREE.Mesh[]; origins: THREE.Vector3[]; }
/** Blackbeard's deck, pistol signal and real ship-port broadside. No gameplay clock or source ownership. */
export class BlackbeardStageArt {
  readonly root = new THREE.Group();
  private muzzle?: THREE.Object3D; private feet: THREE.Object3D[];
  private shadow: THREE.Mesh; private pistolFlash: THREE.Mesh;
  private salvos: Salvo[] = []; private count = 0; private lastTime = 0; private pistolAge = 10;
  private baseShip = new THREE.Vector3(); private direction = new THREE.Vector3(); private point = new THREE.Vector3();
  private target = new THREE.Vector3(); private normal = new THREE.Vector3(); private xAxis = new THREE.Vector3(); private basis = new THREE.Matrix4();
  constructor(private actor: THREE.Group, clone: THREE.Object3D, private ship: THREE.Group, owner: EraArtOwner) {
    this.root.name = 'Blackbeard: command deck and three broadsides'; this.baseShip.copy(ship.position);
    this.muzzle = clone.getObjectByName('Blackbeard_Muzzle'); this.feet = ['FootL','FootR'].map(n=>clone.getObjectByName(n)).filter((n):n is THREE.Object3D=>!!n);
    const deckMaterial = owner.material(0x273132, 1), seams = owner.material(0x816340, .38);
    const deck = owner.mesh(new THREE.PlaneGeometry(7.2, 7.5), deckMaterial, this.root); deck.rotation.x = -Math.PI/2; deck.position.set(0,-.032,-.7); deck.name='Blackbeard foreground quarterdeck';
    for(let i=0;i<12;i++){const seam=owner.mesh(new THREE.PlaneGeometry(7.2,.018),seams,this.root);seam.rotation.x=-Math.PI/2;seam.position.set(0,-.023,-4.1+i*.62);}
    // Foreground rails deliberately frame, not obstruct, the captain and firearm.
    const wood=owner.material(0x15252b,1),brass=owner.material(0x91764a,.8);
    for(const side of[-1,1]){const rail=owner.mesh(new THREE.BoxGeometry(.09,.11,6.2),wood,this.root);rail.position.set(side*3.4,.7,-1);for(let i=0;i<4;i++){const post=owner.mesh(new THREE.BoxGeometry(.11,.8,.11),wood,this.root);post.position.set(side*3.4,.3,-3.7+i*1.8);}const cap=owner.mesh(new THREE.BoxGeometry(.16,.05,6.2),brass,this.root);cap.position.set(side*3.4,.78,-1);}
    const shadowMaterial=owner.material(0x000609,.75);shadowMaterial.vertexColors=true;
    this.shadow=owner.mesh(radialGeometry(.95),shadowMaterial,this.root);this.shadow.name='Blackbeard contact shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.y=.6;this.shadow.position.y=-.012;
    const flashGeometry=radialGeometry(1),flashMaterial=owner.material(0xffe5ac,.9);flashMaterial.vertexColors=true;flashMaterial.toneMapped=false;
    this.pistolFlash=owner.mesh(flashGeometry,flashMaterial,this.root);this.pistolFlash.name='Blackbeard actual muzzle signal';this.pistolFlash.visible=false;
    // Stage-owned close-shot barrels overlay the distant map LOD without changing that asset.
    const tubeGeometry=new THREE.CylinderGeometry(.22,.28,1.15,16,1,true),ringGeometry=new THREE.TorusGeometry(1,.12,5,16),boreGeometry=new THREE.CircleGeometry(.195,20),carriageGeometry=new THREE.BoxGeometry(1,1,1);
    const iron=new THREE.MeshStandardMaterial({color:0x45535b,roughness:.42,metalness:.7,side:THREE.DoubleSide});
    const rim=new THREE.MeshStandardMaterial({color:0x938978,roughness:.34,metalness:.65});
    const timber=new THREE.MeshStandardMaterial({color:0x523a29,roughness:.9});const bore=owner.material(0x020406,1);
    for(let i=0;i<7;i++){
      const barrel=new THREE.Group();barrel.name='Blackbeard hero cannon '+(i+1);barrel.position.set(-6.05,2.68,-8.4+i*(42*.43/6));barrel.rotation.y=-Math.PI/2;ship.add(barrel);
      const tube=owner.mesh(tubeGeometry,iron,barrel);tube.rotation.x=Math.PI/2;
      for(const [z,radius]of [[.575,.23],[.26,.25],[-.18,.27],[-.50,.29]]){const ring=owner.mesh(ringGeometry,rim,barrel);ring.position.z=z;ring.scale.setScalar(radius);}
      const hole=owner.mesh(boreGeometry,bore,barrel);hole.position.z=.50;hole.name='Blackbeard recessed dark bore '+(i+1);
      for(const side of[-1,1]){const rail=owner.mesh(carriageGeometry,timber,barrel);rail.position.set(side*.32,-.28,-.25);rail.scale.set(.12,.22,.8);}
    }
    const smokeGeometry=radialGeometry(1),traceGeometry=softTracerGeometry();
    for(let wave=0;wave<3;wave++){
      const flash=owner.material(0xffd395,.88);flash.vertexColors=true;flash.toneMapped=false;
      const smoke=owner.material(0x839499,.34);smoke.vertexColors=true;
      const trace=owner.material(0xffc888,.74);trace.vertexColors=true;trace.toneMapped=false;
      const salvo:Salvo={age:10,enabled:[],flashes:[],smoke:[],traces:[],origins:[]};
      for(let i=0;i<7;i++){
        const f=owner.mesh(flashGeometry,flash,this.root),s=owner.mesh(smokeGeometry,smoke,this.root),t=owner.mesh(traceGeometry,trace,this.root);
        f.name=`Blackbeard salvo ${wave+1} port ${i+1} flash`;s.name=`Blackbeard salvo ${wave+1} port ${i+1} smoke`;t.name=`Blackbeard salvo ${wave+1} port ${i+1} trace`;
        f.visible=s.visible=t.visible=false;salvo.flashes.push(f);salvo.smoke.push(s);salvo.traces.push(t);salvo.origins.push(new THREE.Vector3());salvo.enabled.push(false);
      }
      this.salvos.push(salvo);
    }
  }
  update(frame:EraArtFrame,camera:THREE.Camera,reduced:boolean){
    const elapsed=Number.isFinite(frame.elapsed)?frame.elapsed:this.lastTime,dt=Math.max(0,Math.min(.1,elapsed-this.lastTime));this.lastTime=elapsed;this.pistolAge+=dt;
    for(const salvo of this.salvos)salvo.age+=dt;
    const next=frame.strikeCount??0;
    if(frame.phase==='release'&&next>this.count){
      this.count=next;const salvo=this.salvos[(Math.max(1,next)-1)%3];salvo.age=0;
      this.ship.updateMatrixWorld(true);this.direction.set(-1,0,0).transformDirection(this.ship.matrixWorld);
      for(let i=0;i<7;i++){
        // Existing buildMaritimeShip flagship: length42, width11.34, deck3.5, 7 real port barrels.
        salvo.origins[i].set(-6.625,2.68,-8.4+i*(42*.43/6)).applyMatrix4(this.ship.matrixWorld);
        salvo.enabled[i]=next>=3||next===1&&(i>=2&&i<=4)||next===2&&(i<2||i>4);
      }
      if(next===1)this.pistolAge=0;
    }
    let recoil=0;for(const salvo of this.salvos)if(salvo.age<.3)recoil=Math.max(recoil,Math.sin(salvo.age/.3*Math.PI));
    this.ship.position.copy(this.baseShip);if(!reduced)this.ship.position.addScaledVector(this.direction,-recoil*.1);
    this.actor.updateMatrixWorld(true);if(this.muzzle)this.muzzle.getWorldPosition(this.pistolFlash.position);else this.pistolFlash.position.set(.5,1.8,.5);
    this.pistolFlash.quaternion.copy(camera.quaternion);this.pistolFlash.visible=this.pistolAge<.16;
    this.pistolFlash.scale.setScalar((reduced?.12:.22)*(1+this.pistolAge*3));
    (this.pistolFlash.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-this.pistolAge/.16)*(reduced?.35:.9);
    if(this.feet.length){this.shadow.position.x=0;this.shadow.position.z=0;for(const foot of this.feet){foot.getWorldPosition(this.point);this.shadow.position.x+=this.point.x/this.feet.length;this.shadow.position.z+=this.point.z/this.feet.length;}}
    for(const salvo of this.salvos){
      const age=salvo.age,visible=(frame.phase==='release'||frame.phase==='outro')&&age<1.1;
      (salvo.flashes[0].material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.18)*(reduced?.28:.88);
      (salvo.smoke[0].material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/1.1)*(reduced?.18:.34);
      (salvo.traces[0].material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-age/.5)*(reduced?.35:.74);
      for(let i=0;i<7;i++){
        const enabled=visible&&salvo.enabled[i]&&(!reduced||i%2===1),origin=salvo.origins[i],flash=salvo.flashes[i],smoke=salvo.smoke[i],trace=salvo.traces[i];
        flash.visible=enabled&&age<.18;flash.position.copy(origin);flash.quaternion.copy(camera.quaternion);flash.scale.setScalar((reduced?.2:.34)+age*.5);
        smoke.visible=enabled;smoke.position.copy(origin).addScaledVector(this.direction,age*(reduced?.8:1.5));smoke.position.y+=age*.4;smoke.quaternion.copy(camera.quaternion);smoke.scale.setScalar(.25+age*(reduced?.65:1.1));
        trace.visible=enabled&&age<.5;trace.position.copy(origin).addScaledVector(this.direction,.6+age*7);this.faceAxis(trace,this.direction,camera);trace.scale.set(reduced?.18:.32,.16+age*.32,1);
      }
    }
  }
  private faceAxis(mesh:THREE.Mesh,axis:THREE.Vector3,camera:THREE.Camera){this.target.copy(camera.position).sub(mesh.position).normalize();this.xAxis.crossVectors(axis,this.target).normalize();if(this.xAxis.lengthSq()<.01)this.xAxis.set(1,0,0);this.normal.crossVectors(this.xAxis,axis).normalize();this.basis.makeBasis(this.xAxis,axis,this.normal);mesh.quaternion.setFromRotationMatrix(this.basis);}
  dispose(){this.root.clear();this.muzzle=undefined;this.feet=[];this.salvos=[];}
}

function softTracerGeometry() {
  const geometry=new THREE.PlaneGeometry(.24,12,2,8),colors:number[]=[];
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const side=Math.abs(p.getX(i))/.12,t=(p.getY(i)+6)/12;colors.push(1,.98,.92,Math.max(0,1-side)*Math.sin(Math.PI*t));}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));return geometry;
}
