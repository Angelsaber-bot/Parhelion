import base64, gzip, json, os, sys, time
from importlib import import_module
from pathlib import Path
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path("arena-game")
sys.path[:0]=[str(root/"tools"),str(root/"scripts")]
review=import_module("review-match")
fit=import_module("fit-match-movement").fit

def inspect():
    cutoff=1795380074611
    get=review.client()
    maps=review.map_aliases()
    selected=["camlann","frostcourt","blackflag","orleans"]
    stats=get(f"/stats?since={1795379127162}&limit=1000")["records"]
    if len(stats)==1000: raise ValueError("Truncated results")
    records=sorted([r for r in stats if r["at"]<=cutoff and maps.get(r["map"]) in selected and r.get("humans")],key=lambda r:r["at"],reverse=True)
    revision=get("/training/status")["dataset"]["revision"]
    captures={}
    after=max(0,revision-320)
    while after<revision:
        rows=get(f"/training/corpus?after={after}&through={revision}",private=True)["records"]
        if not rows: break
        for row in rows:
            after=row["id"];batch=row["batch"];at=row["receivedAt"]
            name=maps.get(batch["map"])
            if name not in selected or at>cutoff+15000: continue
            cap=captures.setdefault(batch["capture"],dict(map=name,first=at,last=at,batches=[]))
            cap["last"]=at
            batch.pop("views",None)
            cap["batches"].append(batch)
    selected_batches=[]; info=[]
    for name in selected:
        matches=[r for r in records if maps[r["map"]]==name and r["at"] in {1795379127163,1795379395927,1795379921120,1795380074611}]
        if not matches:return dict(error="missing score",map=name,recent=[(maps[r["map"]],r["at"]) for r in records[:4]])
        match=matches[0];lo,hi=review.window(match)
        same=[c for c in captures.values() if c["map"]==name]
        options=[c for c in same if lo<=c["first"]<=c["last"]<=hi]
        if len(options)!=1:
            return dict(error="match correspondence",map=name,score_times=[r['at'] for r in matches[:3]],receipts=[(c['first'],c['last'],len(c['batches'])) for c in same], window=[lo,hi])
        candidate=options[0]
        batches=sorted(candidate["batches"],key=lambda b:b["sequence"])
        if len({b['capture'] for b in batches})!=1 or batches[0]['sequence']!=0:raise ValueError("Incomplete start")
        selected_batches.append(batches)
        info.append(dict(map=name,at=match["at"],score=match["score"],result=match["result"],ticks=match["ticks"],batches=len(batches),source=match["source"]))
    from hashlib import sha256
    model=json.loads(Path('arena-game/shared/directPolicy.json').read_bytes())
    result=import_module("fit-player-policy").fit_player(model, selected_batches, holdout=3)
    result["captures"]=[sha256(b[0]["capture"].encode()).hexdigest() for b in selected_batches]
    return result
try: result=inspect()
except Exception as exc: result=dict(error=type(exc).__name__,detail=str(exc)[:110] if 'rows' not in str(exc) else 'invalid training input')
key=AESGCM.generate_key(bit_length=256);nonce=os.urandom(12)
pub=serialization.load_pem_public_key(Path('.github/practice-report.pub').read_bytes())
packed=pub.encrypt(key,padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))+nonce+AESGCM(key).encrypt(nonce,gzip.compress(json.dumps(result).encode()),None)
print('PRIVATE_PRACTICE_RESULT='+base64.b64encode(packed).decode(),flush=True)
