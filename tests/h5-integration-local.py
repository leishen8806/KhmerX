import os,json,uuid,urllib.request,urllib.error,http.cookies
BASE=os.environ.get('H5_TEST_URL','http://localhost:5174')
assert urllib.parse.urlparse(BASE).hostname in ['localhost','127.0.0.1']
class Client:
 def __init__(self):self.cookies={'__sites_local_auth':'1'}
 def request(self,path,body=None,origin=BASE,owner=True):
  headers={'Content-Type':'application/json','Origin':origin,'Cookie':'; '.join(k+'='+v for k,v in self.cookies.items() if owner or k!='__sites_local_auth')}
  req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  try:r=urllib.request.urlopen(req)
  except urllib.error.HTTPError as e:r=e
  for h in r.headers.get_all('Set-Cookie',[]):
   c=http.cookies.SimpleCookie();c.load(h)
   for k,v in c.items():
    assert v['httponly'] and v['samesite']=='Strict'
    if v['max-age']=='0':self.cookies.pop(k,None)
    else:self.cookies[k]=v.value
  raw=r.read().decode()
  try:data=json.loads(raw)
  except:data={'error':'non-json'}
  return r.status,data
 def login(self,phone):
  assert self.request('/api/h5/auth')[0]==200
  status,data=self.request('/api/h5/auth/send',dict(phone=phone,consent=True));assert status==200,(status,data)
  self.challenge=data
  assert self.request('/api/h5/auth/verify',dict(challengeId=data['challengeId'],code=data['demoCode']))[0]==200
 def act(self,action,**kwargs):return self.request('/api/h5/state',dict(action=action,role='mini',requestId=str(uuid.uuid4()),**kwargs))
a=Client();assert a.request('/api/h5/state')[0]==401
assert a.request('/api/h5/auth',owner=False)[0]==401
assert a.request('/api/h5/auth')[0]==200
assert a.request('/api/h5/auth/send',dict(phone='+12025550190',consent=False))[0]==400
assert a.request('/api/h5/auth/send',dict(phone='+12025550190',consent=True),origin='https://untrusted.example')[0]==403
status,c=a.request('/api/h5/auth/send',dict(phone='+12025550190',consent=True));assert status==200,(status,c)
assert a.request('/api/h5/auth/send',dict(phone='+12025550190',consent=True))[0]==429
bad='111111' if c['demoCode']!='111111' else '000000'
assert a.request('/api/h5/auth/verify',dict(challengeId=c['challengeId'],code=bad))[0]==400
assert a.request('/api/h5/auth/verify',dict(challengeId=c['challengeId'],code=c['demoCode']))[0]==200
assert a.request('/api/h5/auth/verify',dict(challengeId=c['challengeId'],code=c['demoCode']))[0]==409
assert a.request('/api/state',owner=False)[0]==401
assert a.act('approve',loanId='fabricated')[0]==404
status,s=a.act('create',name='H5 隔离验收 A',amount=3000,botId='bot-1',consent=True);assert status==200,(status,s)
loan_a=s['state']['loans'][0]['id']
b=Client();b.login('+12025550191')
assert all(l['id']!=loan_a for l in b.request('/api/h5/state')[1]['state']['loans'])
assert b.act('submit_kyc',loanId=loan_a,consent=True)[0]==404
assert a.act('submit_kyc',loanId=loan_a,consent=True)[0]==409
staff=a.request('/api/state')[1]['state'];assert any(l['id']==loan_a and l['phoneMasked'] for l in staff['loans'])
assert a.request('/api/h5/auth/logout',{})[0]==200
assert a.request('/api/h5/state')[0]==401
assert b.request('/api/h5/auth/logout',{})[0]==200
print('PASS: auth gate, CSRF, consent, cooldown, invalid OTP, valid session, replay, customer isolation, KYC gate, staff queue, logout')
