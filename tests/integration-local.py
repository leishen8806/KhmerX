import urllib.request,urllib.error,json,uuid,concurrent.futures
BASE='http://localhost:5173'
def request(path='/api/state',body=None,auth=True,origin=BASE):
 headers={'Content-Type':'application/json','Origin':origin}
 if auth:headers['Cookie']='__sites_local_auth=1'
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  r=urllib.request.urlopen(req);return r.status,json.loads(r.read())
 except urllib.error.HTTPError as e:
  raw=e.read().decode()
  try:data=json.loads(raw)
  except:data={'error':raw[:100]}
  return e.code,data
def act(action,role,loanId=None,**kwargs):
 body=dict(action=action,role=role,loanId=loanId,requestId=str(uuid.uuid4()),**kwargs)
 status,data=request(body=body)
 assert status==200,(action,status,data)
 return data['state']
assert request(auth=False)[0]==401
assert request(body={},origin='https://untrusted.example')[0]==403
s=act('create','mini',name='Sok Dara · 正常结清测试',amount=5000,botId='bot-1',consent=True);id1=s['loans'][0]['id']
for a,r in [('submit_kyc','mini'),('review','ops'),('apply','mini'),('approve','lender'),('sign','mini')]:s=act(a,r,id1,consent=True,signature='Sok Dara')
payload=dict(action='disburse',role='lender',loanId=id1,requestId=str(uuid.uuid4()))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(lambda _:request(body=payload),range(2)))
assert all(x[0]==200 for x in responses),responses
s=request()[1]['state'];assert len([x for x in s['entries'] if x['loanId']==id1 and x['kind']=='测试放款'])==1
s=act('withdraw','mini',id1);s=act('repay','mini',id1,cents=2000);s=act('repay','mini',id1,cents=3200)
assert next(x for x in s['loans'] if x['id']==id1)['status']=='closed'
s=act('create','mini',name='Srey Mom · 逾期测试',amount=3000,botId='bot-2',consent=True);id2=s['loans'][0]['id']
for a,r in [('submit_kyc','mini'),('review','ops'),('apply','mini'),('approve','lender'),('sign','mini'),('disburse','lender')]:s=act(a,r,id2,consent=True,signature='Srey Mom')
s=act('withdraw','mini',id2);s=act('overdue','ops',id2,days=3)
assert s['notifications'][0]['botId']=='bot-2'
assert request('/api/bots',dict(botId='bot-1'))[1]['connected']==False
s=act('create','mini',name='Chan Dara · 待审核示例',amount=5000,botId='bot-1',consent=True);id3=s['loans'][0]['id'];s=act('submit_kyc','mini',id3,consent=True)
s=act('create','mini',name='Vanna · 待机构审批',amount=10000,botId='bot-2',consent=True);id4=s['loans'][0]['id']
for a,r in [('submit_kyc','mini'),('review','ops'),('apply','mini')]:s=act(a,r,id4,consent=True)
check=request()[1]['state'];assert len(check['loans'])==4
print(json.dumps(dict(result='PASS',checks=['unauthenticated rejected','cross-origin rejected','registration to settlement','concurrent identical disbursement once','partial repayment','second bot routing','overdue scenario','persistent readback','unconfigured bot reports disconnected'],loanCount=len(check['loans']),events=len(check['events']),entries=len(check['entries'])),ensure_ascii=False))
