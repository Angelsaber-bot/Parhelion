import type { Object3D } from 'three';
/** Audit helper only: detach source metadata geometry without disposing resources. */
export function sourceNodeHandles(scene:Object3D){
 const root=scene.getObjectByName('World');if(!root)throw new Error('Missing production World');
 const handles:{node:Object3D;parent:Object3D;index:number}[]=[];
 root.traverse(node=>{if((node.name==='COLLISION'||node.name==='MARKERS')&&node.parent)handles.push({node,parent:node.parent,index:node.parent.children.indexOf(node)});});
 return {handles,detach(){for(const h of handles)h.node.removeFromParent();},restore(){for(const h of handles){h.parent.add(h.node);const children=h.parent.children;children.splice(children.indexOf(h.node),1);children.splice(h.index,0,h.node);}}};
}
