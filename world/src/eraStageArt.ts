import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  private shadow: THREE.Mesh; private pistolFlash: THREE.Mesh;private pennant?:THREE.Mesh;private signalSmoke:THREE.Mesh[]=[];private signalOrigin=new THREE.Vector3();
  private barrels:THREE.Group[]=[];private salvos: Salvo[] = []; private count = 0; private lastTime = 0; private pistolAge = 10;
  private lanterns: THREE.PointLight[] = []; private cannonLight = new THREE.PointLight(0xffa047,0,18,2); private sea?: THREE.Mesh;
  private baseShip = new THREE.Vector3(); private direction = new THREE.Vector3(); private point = new THREE.Vector3();
  private target = new THREE.Vector3(); private normal = new THREE.Vector3(); private xAxis = new THREE.Vector3(); private basis = new THREE.Matrix4();
  constructor(private actor: THREE.Group, clone: THREE.Object3D, private ship: THREE.Group, owner: EraArtOwner) {
    this.root.name = 'Blackbeard: command deck and three broadsides'; this.baseShip.copy(ship.position);
    this.muzzle = clone.getObjectByName('Blackbeard_Muzzle'); this.feet = ['FootL','FootR'].map(n=>clone.getObjectByName(n)).filter((n):n is THREE.Object3D=>!!n);
    const deckMaterial = owner.material(0x273132, 1), seams = owner.material(0x816340, .38);
    const deck = owner.mesh(new THREE.PlaneGeometry(7.2, 7.5), deckMaterial, this.root); deck.rotation.x = -Math.PI/2; deck.position.set(0,-.032,-.7); deck.name='Blackbeard foreground quarterdeck';
    const seamGeometry=new THREE.PlaneGeometry(7.2,.018);
    for(let i=0;i<12;i++){const seam=owner.mesh(seamGeometry,seams,this.root);seam.rotation.x=-Math.PI/2;seam.position.set(0,-.023,-4.1+i*.62);}
    // Foreground rails deliberately frame, not obstruct, the captain and firearm.
    const wood=owner.material(0x15252b,1),brass=owner.material(0x91764a,.8);
    for(const side of[-1,1]){const rail=owner.mesh(new THREE.BoxGeometry(.09,.11,6.2),wood,this.root);rail.position.set(side*3.4,.7,-1);for(let i=0;i<4;i++){const post=owner.mesh(new THREE.BoxGeometry(.11,.8,.11),wood,this.root);post.position.set(side*3.4,.3,-3.7+i*1.8);}const cap=owner.mesh(new THREE.BoxGeometry(.16,.05,6.2),brass,this.root);cap.position.set(side*3.4,.78,-1);}
    const shadowMaterial=owner.material(0x000609,.75);shadowMaterial.vertexColors=true;
    this.shadow=owner.mesh(radialGeometry(.95),shadowMaterial,this.root);this.shadow.name='Blackbeard contact shadow';this.shadow.rotation.x=-Math.PI/2;this.shadow.scale.y=.6;this.shadow.position.y=.004;
    const flashGeometry=radialGeometry(1),flashMaterial=owner.material(0xffe5ac,.9);flashMaterial.vertexColors=true;flashMaterial.toneMapped=false;
    this.pistolFlash=owner.mesh(flashGeometry,flashMaterial,this.root);this.pistolFlash.name='Blackbeard actual muzzle signal';this.pistolFlash.visible=false;
    // Stage-owned close-shot barrels overlay the distant map LOD without changing that asset.
    const tubeGeometry=new THREE.CylinderGeometry(.22,.28,1.15,12,1,true),ringGeometry=new THREE.TorusGeometry(1,.12,3,10),boreGeometry=new THREE.CircleGeometry(.195,16),carriageGeometry=new THREE.BoxGeometry(1,1,1);
    const iron=new THREE.MeshStandardMaterial({color:0x45535b,roughness:.42,metalness:.7,side:THREE.DoubleSide});
    const rim=new THREE.MeshStandardMaterial({color:0x938978,roughness:.34,metalness:.65});
    const timber=new THREE.MeshStandardMaterial({color:0x523a29,roughness:.9});const bore=owner.material(0x020406,1);
    for(let i=0;i<7;i++){
      const barrel=new THREE.Group();barrel.name='Blackbeard hero cannon '+(i+1);barrel.position.set(-6.05,2.68,-8.4+i*(42*.43/6));barrel.rotation.y=-Math.PI/2;ship.add(barrel);this.barrels.push(barrel);
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
    this.buildQuarterdeck(owner);
    // Original dimensional command pennant and rigging, not a portrait overlay.
    const pole=owner.mesh(new THREE.CylinderGeometry(.028,.04,3.1,8),wood,this.root);pole.position.set(-2.5,1.5,-2.5);pole.name='Blackbeard command pennant mast';
    const flagGeometry=new THREE.PlaneGeometry(1.35,.9,8,6);flagGeometry.translate(.675,-.45,0);const fp=flagGeometry.attributes.position;for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i);if(x>1.1)fp.setX(i,x-.18*(1-Math.abs(y+.45)/.45));}
    this.pennant=owner.mesh(flagGeometry,new THREE.MeshStandardMaterial({color:0x17242c,roughness:.92,side:THREE.DoubleSide}),this.root);this.pennant.position.set(-2.47,2.9,-2.49);this.pennant.name='Blackbeard modeled command pennant';
    const badge=owner.mesh(new THREE.TorusGeometry(.16,.014,6,24),brass,this.root);badge.position.set(-1.9,2.45,-2.46);badge.name='Blackbeard original compass badge';
    for(const side of[-1,1]){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-2.5,3,-2.5),new THREE.Vector3(side*2.8,1.8,-3.1),new THREE.Vector3(side*3.25,.75,-3.5)]);owner.mesh(new THREE.TubeGeometry(path,12,.012,4,false),seams,this.root);}
    const smokeMat=owner.material(0xb5b5a5,.25);smokeMat.vertexColors=true;for(let i=0;i<3;i++){const puff=owner.mesh(radialGeometry(1),smokeMat,this.root);puff.name='Blackbeard actual flintlock smoke '+i;puff.visible=false;this.signalSmoke.push(puff);}

  }
  private buildQuarterdeck(owner:EraArtOwner){
    // Real modeled depth for changing camera angles: merged timber, fittings and ropes.
    const timber:THREE.BufferGeometry[]=[],brass:THREE.BufferGeometry[]=[],ropes:THREE.BufferGeometry[]=[];
    const box=(list:THREE.BufferGeometry[],x:number,y:number,z:number,sx:number,sy:number,sz:number,ry=0)=>{
      const g=new THREE.BoxGeometry(sx,sy,sz);g.rotateY(ry);g.translate(x,y,z);list.push(g);
    };
    const cylinder=(list:THREE.BufferGeometry[],x:number,y:number,z:number,r:number,h:number)=>{
      const g=new THREE.CylinderGeometry(r,r,h,10);g.translate(x,y,z);list.push(g);
    };
    // Staggered quarterdeck boards read as a real surface in low sword/gun shots.
    for(let row=0;row<11;row++)for(let j=0;j<3;j++)box(timber,-2.32+j*2.32,-.025,-3.6+row*.58,2.29,.045,.55);
    // Raised stern furniture stays behind the performer, away from hands and face.
    for(const side of[-1,1]){
      box(timber,side*2.8,.43,-3.45,.54,.85,.62);
      box(brass,side*2.8,.87,-3.45,.60,.045,.68);
      cylinder(timber,side*2.65,.57,-2.1,.38,1.1);
      for(const y of[.16,.88]){const band=new THREE.TorusGeometry(.385,.027,4,12);band.rotateX(Math.PI/2);band.translate(side*2.65,y,-2.1);brass.push(band);}
      for(let j=0;j<5;j++){const coil=new THREE.TorusGeometry(.22+j*.026,.014,3,12);coil.rotateX(Math.PI/2);coil.translate(side*2.65,.09,-.5);ropes.push(coil);}
      cylinder(brass,side*2.8,1.22,-3.45,.025,.75);
      const glow=new THREE.MeshStandardMaterial({color:0xffd38b,emissive:0xffb44b,emissiveIntensity:2,roughness:.6});
      const lamp=owner.mesh(new THREE.CylinderGeometry(.095,.11,.28,8),glow,this.root);lamp.position.set(side*2.8,1.55,-3.45);lamp.name='Blackbeard deck lantern '+side;
      for(const y of[1.38,1.72]){const cap=new THREE.ConeGeometry(.15,.09,8);cap.translate(side*2.8,y,-3.45);brass.push(cap);}
      const light=new THREE.PointLight(0xffb763,2,5,2);light.position.copy(lamp.position);this.root.add(light);this.lanterns.push(light);
    }
    // Wheel is an actual rim and eight spokes, not a painted disk.
    const wheel=new THREE.TorusGeometry(.53,.055,4,16);wheel.translate(1.8,1.08,-3.55);timber.push(wheel);
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;const spoke=new THREE.CylinderGeometry(.025,.025,1.32,6);spoke.rotateZ(angle);spoke.translate(1.8,1.08,-3.55);timber.push(spoke);}
    cylinder(timber,1.8,.55,-3.64,.12,1.1);
    const emit=(pieces:THREE.BufferGeometry[],mat:THREE.Material,name:string)=>{const g=mergeGeometries(pieces);for(const p of pieces)p.dispose();if(g){const m=owner.mesh(g,mat,this.root);m.name=name;}};
    emit(timber,new THREE.MeshStandardMaterial({color:0x594332,roughness:.86}),'Blackbeard modeled quarterdeck boards barrels and helm');
    emit(brass,new THREE.MeshStandardMaterial({color:0xa28a51,metalness:.65,roughness:.38}),'Blackbeard brass deck fittings');
    emit(ropes,new THREE.MeshStandardMaterial({color:0xa39168,roughness:1}),'Blackbeard coiled hemp ropes');
    const seaGeometry=new THREE.PlaneGeometry(80,80,20,20);seaGeometry.rotateX(-Math.PI/2);seaGeometry.translate(0,0,-45);const p=seaGeometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,.04+.065*Math.sin(p.getX(i)*1.7+p.getZ(i)*.5)+.035*Math.cos(p.getZ(i)*2.6));seaGeometry.computeVertexNormals();
    this.sea=owner.mesh(seaGeometry,new THREE.MeshStandardMaterial({color:0x0b2635,roughness:.82,metalness:.04}),this.root);this.sea.name='Blackbeard modeled moonlit sea';
    this.cannonLight.name='Blackbeard salvo illumination';this.cannonLight.position.set(-1,3,-6);this.root.add(this.cannonLight);
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
      if(next===1){this.pistolAge=0;this.actor.updateMatrixWorld(true);if(this.muzzle)this.muzzle.getWorldPosition(this.signalOrigin);}
    }
    if(this.pennant){const p=this.pennant.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,reduced?0:Math.sin(x*5+y*2+elapsed*4)*.07*(x/1.35));}p.needsUpdate=true;this.pennant.geometry.computeVertexNormals();}
    for(let i=0;i<this.signalSmoke.length;i++){const puff=this.signalSmoke[i],age=this.pistolAge-i*.045;puff.visible=age>=0&&age<.65&&(!reduced||i===0);puff.position.copy(this.signalOrigin);puff.position.y+=Math.max(0,age)*.32;puff.position.x+=Math.sin(i*2)*Math.max(0,age)*.16;puff.position.z+=Math.max(0,age)*.35;puff.quaternion.copy(camera.quaternion);puff.scale.setScalar(.08+Math.max(0,age)*.35);}
    let recoil=0;for(const salvo of this.salvos)if(salvo.age<.3)recoil=Math.max(recoil,Math.sin(salvo.age/.3*Math.PI));
    this.cannonLight.intensity=reduced?0:recoil*18;
    for(let i=0;i<this.lanterns.length;i++)this.lanterns[i].intensity=1.8+(reduced?0:Math.sin(elapsed*7+i)*.12);
    for(let i=0;i<this.barrels.length;i++){let kick=0;for(const salvo of this.salvos)if(salvo.enabled[i]&&salvo.age<.38)kick=Math.max(kick,Math.sin(salvo.age/.38*Math.PI));this.barrels[i].position.x=-6.05+kick*(reduced?.04:.17);}
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
  dispose(){this.root.clear();this.muzzle=undefined;this.feet=[];this.salvos=[];this.barrels=[];this.lanterns=[];this.sea=undefined;this.pennant=undefined;this.signalSmoke=[];}
}

function softTracerGeometry() {
  const geometry=new THREE.PlaneGeometry(.24,12,2,8),colors:number[]=[];
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const side=Math.abs(p.getX(i))/.12,t=(p.getY(i)+6)/12;colors.push(1,.98,.92,Math.max(0,1-side)*Math.sin(Math.PI*t));}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));return geometry;
}
