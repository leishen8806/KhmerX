import json,urllib.request
c=json.load(open('/opt/payease/data/config.json'))
r=urllib.request.Request('http://127.0.0.1:4300/api/jobs/postloan',data=b'{}',headers={'Host':c['host'],'Authorization':'Bearer '+c['bindings']['POSTLOAN_JOB_SECRET'],'Content-Type':'application/json'})
with urllib.request.urlopen(r,timeout=60) as response:
 d=json.load(response)
 if not d.get('ok'):raise RuntimeError('Job failed')
 print(json.dumps({k:d.get(k) for k in ['ok','companies','checkedAt']}))
