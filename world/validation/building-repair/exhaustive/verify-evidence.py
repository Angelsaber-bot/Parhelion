"""Verify the delivered evidence ledger and current exported assets without rendering."""
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent
ledger=json.load(open(root/'buildings.json'));provenance=json.load(open(root/'provenance.json'));runtime=json.load(open(root/'runtime-parity.json'))
items=ledger['items'];assert len(items)==provenance['reviewItems']+runtime['units']==len({i['id']for i in items})
assert not any(i['status']=='pending'for i in items)
for i in items:
 assert 1<=i['row']<=6 and len(i['views'])==6
 assert (root/i['evidence']).is_file(),i['id']
for name,value in json.load(open(root/'image-manifest.json')).items():
 raw=(root/name).read_bytes();assert len(raw)==value['bytes']and hashlib.sha256(raw).hexdigest()==value['sha256'],name
assets=root.parents[2]/'public/assets'
for row in json.load(open(root/'asset-manifest.json')):
 raw=(assets/row['file']).read_bytes();assert len(raw)==row['bytes']and hashlib.sha256(raw).hexdigest()==row['sha256'],row['file']
ground=json.load(open(root/'ground-findings.json'));shell=json.load(open(root/'shell-findings.json'));attic=json.load(open(root/'attic-envelope-findings.json'));geo=json.load(open(root/'geometry-findings.json'))
assert not ground['requiresReview']and ground['samples']==ground['houses']*25
assert not shell['issues']and not attic['failedAttics']and not geo['issues']and not geo['stats']['nonFinite']
assert not provenance['parityMismatches']and runtime['finalGeometryAndColorsMatchAtlasByteForByte']
print(f"Verified {len(items)} reviewed units, {ledger['imageSheets']} sheets, {ground['samples']} ground probes, {attic['probes']} attic probes, and current asset hashes.")
