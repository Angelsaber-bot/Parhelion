"""Verify the actual GLB bytes against metre-scale JSON, without external libraries."""
from pathlib import Path
import json,struct,math,hashlib
ROOT=Path(__file__).resolve().parents[1]
layout=json.loads((ROOT/'runtime/map.json').read_text());by_id={o['id']:o for o in layout['objects']}
report={'mapId':layout['mapId'],'version':layout['version'],'files':[]}
for name,prefix,expected in [('station_visual.glb','VIS_',None),('station_collision.glb','COL_',36)]:
    path=ROOT/'assets'/name;raw=path.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and length==len(raw)
    json_len,json_type=struct.unpack_from('<II',raw,12);assert json_type==0x4e4f534a
    doc=json.loads(raw[20:20+json_len]);bin_len,bin_type=struct.unpack_from('<II',raw,20+json_len)
    assert bin_type==0x004e4942 and 20+json_len+8+bin_len==len(raw)
    assert all('uri' not in b for b in doc['buffers']), 'Unexpected external asset'
    expected = expected or len(doc['nodes'])
    assert len(doc['meshes'])==expected and len(doc['nodes'])==expected
    assert all(n['name'].startswith(prefix) or (prefix=='VIS_' and n['name'].startswith('DETAIL_') and n.get('extras',{}).get('decorative') is True and n['extras']['collision'] is False) for n in doc['nodes'])
    if prefix=='VIS_':
        assert sum(n['name'].startswith('VIS_') for n in doc['nodes'])==len(layout['objects'])
        assert sum(n['name'].startswith('DETAIL_') for n in doc['nodes'])<=20, 'Decoration batch budget exceeded'
        assert len(doc['materials'])>=12
        assert any(m.get('emissiveFactor') for m in doc['materials'])
        assert len({m['pbrMetallicRoughness'].get('roughnessFactor',1) for m in doc['materials']})>=5
        assert not doc.get('images'), 'Unexpected texture dependency'
    triangle_count=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    assert triangle_count<120000, 'Runtime triangle budget exceeded'
    node_results=[]
    for node in doc['nodes']:
        if node['name'].startswith('DETAIL_'):continue
        source=node['extras']['source_id'];o=by_id[source];assert o['collision'] or prefix=='VIS_'
        assert not node.get('rotation') and not node.get('matrix') and not node.get('scale'), 'Unexpected transform'
        prim=doc['meshes'][node['mesh']]['primitives'][0];acc=doc['accessors'][prim['attributes']['POSITION']]
        trans=node.get('translation',[0,0,0]);mn=[a+b for a,b in zip(acc['min'],trans)];mx=[a+b for a,b in zip(acc['max'],trans)]
        x,y,z=o['position'];w,h,d=o['size']
        expected_min=[x-w/2,y-(h/2 if o['type']=='box' else 0),z-d/2]
        expected_max=[x+w/2,y+(h/2 if o['type']=='box' else h),z+d/2]
        error=max(abs(a-b) for a,b in zip(mn+mx,expected_min+expected_max));assert error<1e-4,(source,error)
        if o['type']=='ramp':
            normal=doc['accessors'][prim['attributes']['NORMAL']];view=doc['bufferViews'][normal['bufferView']]
            offset=20+json_len+8+view.get('byteOffset',0)+normal.get('byteOffset',0)
            vals=struct.unpack_from('<'+'f'*(normal['count']*3),raw,offset)
            assert any(vals[i]>.85 for i in range(1,len(vals),3)), 'No upward ramp normals'
        node_results.append({'id':source,'boundsErrorMetres':error})
    report['files'].append({'name':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'nodes':expected,'triangles':triangle_count,'materialCount':len(doc.get('materials',[])),'embeddedBuffers':True,'allBoundsMatch':True,'rampNormalsPass':True,'maxBoundsErrorMetres':max(n['boundsErrorMetres'] for n in node_results)})
blend=ROOT/'assets/aster_research_station.blend';assert blend.read_bytes()[:7]==b'BLENDER' or blend.read_bytes()[:4]==b'\x28\xb5\x2f\xfd', 'Not a Blender file'
report['blend']={'name':blend.name,'bytes':blend.stat().st_size,'sha256':hashlib.sha256(blend.read_bytes()).hexdigest()}
(ROOT/'validation/export_report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
