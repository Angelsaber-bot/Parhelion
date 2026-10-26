(async function(){
 const map=await (await fetch('map.json')).json(),P=MapPhysics,view=document.querySelector('#view');
 const renderer=new THREE.WebGLRenderer({canvas:view,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x98adba);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.23;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa8bec9,45,100);
 scene.add(new THREE.HemisphereLight(0xdceeff,0x536372,2.1));const sun=new THREE.DirectionalLight(0xffe7c8,3.1);sun.position.set(-22,35,18);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-48,right:48,top:44,bottom:-44,near:1,far:100});sun.shadow.bias=-.00025;sun.shadow.normalBias=.045;scene.add(sun);scene.fog=new THREE.Fog(0x98adba,100,210);
 const camera=new THREE.PerspectiveCamera(74,1,.05,220);camera.rotation.order='YXZ';
 const meshes=[],exportMaterials=[];
 // Minimal importer for this project's embedded, uncompressed, static Blender GLB.
 // Unsupported features fail explicitly; general character/animation import is outside this viewer.
 const visualResponse=await fetch('../assets/station_visual.glb');if(!visualResponse.ok)throw Error('Visual GLB missing');
 const bytes=await visualResponse.arrayBuffer(),dv=new DataView(bytes);if(dv.getUint32(0,true)!==0x46546c67)throw Error('Invalid GLB');
 const jsonLength=dv.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,jsonLength))),binStart=20+jsonLength+8;
 if(gltf.buffers.some(b=>b.uri))throw Error('External GLB buffers are unsupported');
 function attribute(index){const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array},sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
   const ArrayType=types[a.componentType],size=sizes[a.type];if(!ArrayType||!size||v.byteStride||a.sparse)throw Error('Unsupported GLB accessor');
   return new THREE.BufferAttribute(new ArrayType(bytes,binStart+(v.byteOffset||0)+(a.byteOffset||0),a.count*size),size,!!a.normalized);
 }
 // glTF factors are linear values. Use the Blender-authored PBR data directly.
 for(const m of gltf.materials){const p=m.pbrMetallicRoughness||{},color=p.baseColorFactor||[1,1,1,1],em=m.emissiveFactor||[0,0,0];
   if(p.baseColorTexture||p.metallicRoughnessTexture||m.normalTexture)throw Error('Texture import requires an explicit extension to this bounded viewer');
   const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(...color.slice(0,3)),metalness:p.metallicFactor??1,roughness:p.roughnessFactor??1,emissive:new THREE.Color().setRGB(...em),emissiveIntensity:m.extensions?.KHR_materials_emissive_strength?.emissiveStrength??1});mat.name=m.name;exportMaterials.push(mat);
 }
 for(const node of gltf.nodes){if(node.mesh===undefined)continue;if(node.children?.length)throw Error('Nested visual mesh not supported');
   const o=map.objects.find(o=>o.id===node.extras?.source_id),detail=node.extras?.decorative===true;
   if(!o&&!detail)throw Error('Visual node lacks Arena identity: '+node.name);
   for(const primitive of gltf.meshes[node.mesh].primitives){if(primitive.mode!==undefined&&primitive.mode!==4)throw Error('Unsupported GLB primitive');const geo=new THREE.BufferGeometry();geo.setAttribute('position',attribute(primitive.attributes.POSITION));
     if(primitive.attributes.NORMAL!==undefined)geo.setAttribute('normal',attribute(primitive.attributes.NORMAL));else geo.computeVertexNormals();
     if(primitive.indices!==undefined)geo.setIndex(attribute(primitive.indices));
     const mesh=new THREE.Mesh(geo,exportMaterials[primitive.material]);mesh.name=o?.id||node.name;mesh.userData.decorative=detail;mesh.castShadow=!detail&&o.role!=='floor'&&o.role!=='wayfinding';mesh.receiveShadow=true;
     if(node.matrix){mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));}else{if(node.translation)mesh.position.fromArray(node.translation);if(node.rotation)mesh.quaternion.fromArray(node.rotation);if(node.scale)mesh.scale.fromArray(node.scale);}
     scene.add(mesh);meshes.push(mesh);
   }
 }
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 if(meshes.filter(m=>!m.userData.decorative).length!==map.objects.length)throw Error('GLB/map base mesh count mismatch');
 function label(text,pos,color='#e9f4f4',scale=4){let c=document.createElement('canvas');c.width=512;c.height=128;let ctx=c.getContext('2d');ctx.fillStyle='#1c3444';ctx.fillRect(0,0,512,128);ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(4,4,504,120);ctx.fillStyle=color;ctx.font='bold 43px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,79);let tex=new THREE.CanvasTexture(c);let sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex}));sp.position.fromArray(pos);sp.scale.set(scale,scale/4,1);scene.add(sp);return sp;}
 label('01 / WEST',[-35.5,3.2,0],'#63d9db',4);label('02 / EAST',[35.5,3.2,0],'#efb76a',4);
 label('GALLERY +3.0 m',[0,5,-24],'#63d9db',5);label('LAB / GROUND',[0,4.2,25],'#efb76a',4.8);label('OBJECTIVE',[0,2.4,9.6],'#63d9db',3);
 const ring=new THREE.Mesh(new THREE.RingGeometry(1.8,1.87,48),new THREE.MeshBasicMaterial({color:0x2f9d9d,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(0,.07,7);scene.add(ring);
 const routeGroup=new THREE.Group();scene.add(routeGroup);routeGroup.visible=false;
 for(const r of map.routes){let points=r.points.map(v=>new THREE.Vector3(v[0],v[1]+.15,v[2]));let line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:r.id.includes('south')?0xefb76a:0x237e90}));routeGroup.add(line);}
 const state={x:-32,y:0,z:-1.5,vy:0,yaw:Math.PI/2,pitch:0};let active=false,overview=false,frame=0,frames=0,fps=0,last=performance.now(),fpsAt=last,tour=null;const tourResults=[];
 const input=ArenaInput.create({window,document,view,isEnabled:()=>active&&!overview,onShortcut:code=>{if(code==='Digit1')spawn('west');if(code==='Digit2')spawn('east');if(code==='KeyM')toggleOverview();if(code==='KeyR')toggleRoutes();},onReset:()=>{if(tour){tour=null;document.querySelector('#tourResult').textContent='巡检已暂停 / 请重新点击步行巡检';}}}),keys=input.keys;
 function focusView(){view.focus({preventScroll:true});}
 function spawn(side){input.reset('spawn');tour=null;focusView();let a=map.anchors.find(a=>a.id==='spawn_'+side+'_01');Object.assign(state,{x:a.position[0],y:0,z:a.position[2],vy:0,yaw:a.yaw,pitch:0});overview=false;active=true;document.querySelector('#intro').classList.add('hidden');document.querySelector('#overview').classList.remove('active');document.querySelector('#crosshair').classList.remove('hidden');}
 function toggleOverview(){input.reset('overview');focusView();overview=!overview;document.querySelector('#overview').classList.toggle('active',overview);document.querySelector('#crosshair').classList.toggle('hidden',overview);if(document.pointerLockElement)document.exitPointerLock();}
 function toggleRoutes(){focusView();routeGroup.visible=!routeGroup.visible;document.querySelector('#routes').classList.toggle('active',routeGroup.visible);}
 document.querySelector('#west').onclick=()=>spawn('west');document.querySelector('#east').onclick=()=>spawn('east');document.querySelector('#overview').onclick=toggleOverview;document.querySelector('#routes').onclick=toggleRoutes;
 document.querySelector('#tour').onclick=()=>{const route=map.routes.find(r=>r.id===document.querySelector('#tourSelect').value);spawn('west');Object.assign(state,{x:route.points[0][0],y:route.points[0][1],z:route.points[0][2],vy:0});tour={route,index:1,time:0,stall:0,minY:100,maxY:-100,distance:0};document.querySelector('#tourResult').classList.remove('hidden');document.querySelector('#tourResult').textContent='巡检中 / '+route.name+' · WASD 可随时接管';};
 function mouseFallback(){input.reset('pointer-error');const n=document.querySelector('#notice');n.classList.remove('hidden');n.textContent='鼠标锁定不可用，可用方向键转向，WASD 步行。';}
 function requestMouse(){if(document.pointerLockElement===view)return;input.reset('pointer-request');if(!view.requestPointerLock){mouseFallback();return;}try{const result=view.requestPointerLock();result?.catch?.(mouseFallback);}catch(e){mouseFallback();}}
 document.querySelector('#start').disabled=false;document.querySelector('#start').textContent='开始步行检查';document.querySelector('#start').onclick=()=>{spawn('west');requestMouse();};
 view.onclick=()=>{focusView();if(active&&!overview)requestMouse();};
 document.addEventListener('pointerlockerror',mouseFallback);document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===view)document.querySelector('#notice').classList.add('hidden');});
 document.addEventListener('mousemove',e=>{if(document.pointerLockElement===view&&!overview){state.yaw+=e.movementX*.0022;state.pitch=Math.max(-1.35,Math.min(1.35,state.pitch-e.movementY*.0022));}});
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
 const mini=document.querySelector('#minimap'),ctx=mini.getContext('2d');
 function minimap(){const sx=Math.min(480/(map.bounds.max[0]-map.bounds.min[0]),360/(map.bounds.max[2]-map.bounds.min[2])),ox=280,oz=220;ctx.clearRect(0,0,560,440);ctx.fillStyle='#172e3d';ctx.fillRect(0,0,560,440);for(const o of map.objects){const [x,y,z]=o.position,[w,h,d]=o.size;ctx.fillStyle=o.role==='floor'?'#324c5b':map.palette[o.material];ctx.globalAlpha=o.collision?.8:.5;ctx.fillRect(ox+(x-w/2)*sx,oz+(z-d/2)*sx,w*sx,d*sx);}ctx.globalAlpha=1;
   if(routeGroup.visible){for(const r of map.routes){ctx.strokeStyle=r.id.includes('south')?'#efb76a':'#63d9db';ctx.lineWidth=2;ctx.beginPath();r.points.forEach((p,i)=>i?ctx.lineTo(ox+p[0]*sx,oz+p[2]*sx):ctx.moveTo(ox+p[0]*sx,oz+p[2]*sx));ctx.stroke();}}
   ctx.strokeStyle='#73e3dc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox,oz+7*sx,2*sx,0,Math.PI*2);ctx.stroke();
   ctx.save();ctx.translate(ox+state.x*sx,oz+state.z*sx);ctx.rotate(state.yaw);ctx.fillStyle='#fffbef';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(-6,7);ctx.lineTo(6,7);ctx.closePath();ctx.fill();ctx.restore();
 }
 function zone(){if(Math.abs(state.x)>26)return state.x<0?'ARRIVAL / WEST':'ARRIVAL / EAST';if(state.z<-13)return state.y>1?'GALLERY / +3.0 m':'GALLERY APPROACH';if(state.z>11)return 'LAB / GROUND FLANK';if(Math.hypot(state.x,state.z-7)<2)return 'OBJECTIVE / CONSOLE';return 'CENTRAL COURT / COVER';}
 function loop(now){input.beginFrame(now);if(now>last)frameTimes.push(now-last);if(frameTimes.length>600)frameTimes.shift();let dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;
   if(active&&!overview){if(keys.has('ArrowLeft'))state.yaw-=1.7*dt;if(keys.has('ArrowRight'))state.yaw+=1.7*dt;if(keys.has('ArrowUp'))state.pitch=Math.min(1.3,state.pitch+dt);if(keys.has('ArrowDown'))state.pitch=Math.max(-1.3,state.pitch-dt);
     let f=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),r=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),len=Math.hypot(f,r)||1;
     let dx=(Math.sin(state.yaw)*f+Math.cos(state.yaw)*r)/len*map.player.walkSpeed*dt,dz=(-Math.cos(state.yaw)*f+Math.sin(state.yaw)*r)/len*map.player.walkSpeed*dt;
     if(tour){if(f||r){tour=null;document.querySelector('#tourResult').textContent='手动接管 / 巡检已暂停';}else{
       const t=tour.route.points[tour.index],d=Math.hypot(t[0]-state.x,t[2]-state.z);tour.time+=dt;
       if(d<.09){tour.index++;if(tour.index===tour.route.points.length){let result={id:tour.route.id,passed:tour.minY>=-.01&&tour.stall<2,seconds:+tour.time.toFixed(2),distance:+tour.distance.toFixed(2),minY:tour.minY,maxY:tour.maxY};tourResults.push(result);document.querySelector('#tourResult').textContent=(result.passed?'PASS':'FAIL')+' / '+tour.route.name+' · '+result.seconds+' s · '+result.distance+' m · 高度 '+result.minY.toFixed(2)+'–'+result.maxY.toFixed(2)+' m';tour=null;}}
       else{const travel=Math.min(d,map.player.walkSpeed*dt);dx=(t[0]-state.x)/d*travel;dz=(t[2]-state.z)/d*travel;state.yaw=Math.atan2(dx,-dz);}
     }}
     const before=[state.x,state.z];P.step(map,state,dx,dz,dt);
     if(tour){let distance=Math.hypot(state.x-before[0],state.z-before[1]);tour.distance+=distance;tour.minY=Math.min(tour.minY,state.y);tour.maxY=Math.max(tour.maxY,state.y);tour.stall=distance<.0001?tour.stall+dt:0;if(tour.stall>2){document.querySelector('#tourResult').textContent='FAIL / route blocked';tourResults.push({id:tour.route.id,passed:false});tour=null;}}
     if(state.y< -8)spawn('west');
   }
   if(overview){camera.position.set(0,76,20);camera.lookAt(0,0,0);}else{camera.position.set(state.x,state.y+map.player.eyeHeight,state.z);camera.rotation.set(state.pitch,-state.yaw,0);}
   renderer.render(scene,camera);frames++;if(now-fpsAt>1000){fps=Math.round(frames*1000/(now-fpsAt));fpsAt=now;frames=0;}
   if(frame++%5===0){minimap();document.querySelector('#zone').textContent=overview?'OVERVIEW / ROUTE INSPECTION':zone();const ft=frameTimes.slice(-300).sort((a,b)=>a-b);document.querySelector('#perf').textContent=`${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} tris · frame p50 ${ft[Math.floor(ft.length*.5)]?.toFixed(1)} / p95 ${ft[Math.floor(ft.length*.95)]?.toFixed(1)} ms · local sample`;document.querySelector('#status').textContent=`${map.mapId} / ${map.version} · X ${state.x.toFixed(1)}  Y ${state.y.toFixed(2)}  Z ${state.z.toFixed(1)} · ${fps} fps`;}
   requestAnimationFrame(loop);
 }
 const frameTimes=[];window.mapQA={map,state,physics:P,renderer,scene,camera,frameTimes,spawn,toggleOverview,meshes,tourResults,geometrySource:'station_visual.glb',ready:true,get status(){return {fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,position:[state.x,state.y,state.z]};}};
 requestAnimationFrame(loop);
})().catch(e=>{console.error(e);document.querySelector('#status').textContent='Map load failed: '+e.message;});
