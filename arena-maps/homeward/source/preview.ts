// Deterministic thumbnail renderer for the shipped map geometry.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,720);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.domElement.style.cssText='display:block;max-width:100%;height:auto';document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#bccdd2');scene.fog=new THREE.Fog('#bccdd2',75,150);
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.45;
scene.add(new THREE.HemisphereLight(0xd3e6f2,0x65523b,1.1));const sun=new THREE.DirectionalLight(0xffdfb0,2.5);sun.position.set(-22,40,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:.1,far:110});sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0xa4afa1,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.41;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(48,1280/720,.1,250);camera.position.set(34,32,39);camera.lookAt(0,1,-3);
const model=(await new GLTFLoader().loadAsync('./homeward-review.glb')).scene;model.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(model);
const status=document.createElement('p');status.textContent='HOMEWARD · 实际地图渲染 · 屋顶 / 双院 / 公共穿堂';document.body.append(status);
const download=document.createElement('a');download.textContent='下载归灯回街封面';download.download='homeward.jpg';document.body.append(download);
function render(){renderer.render(scene,camera);download.href=renderer.domElement.toDataURL('image/jpeg',.95);}
for(const [name,pos,target] of [['双院全景',[34,32,39],[0,1,-3]],['灯院近景',[-24,15,24],[-3,1,-7]],['屋顶俯瞰',[25,42,32],[0,1,-3]]] as const){const button=document.createElement('button');button.textContent=name;button.onclick=()=>{camera.position.set(...pos);camera.lookAt(...target);render();};document.body.append(button);}
render();
