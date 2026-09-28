import type {Postloan} from './postloan/core';
import {syncSettlements} from './postloan/core.ts';
import type {Bill} from './pricing';
export type Role='mini'|'ops'|'lender';
export type Status='registered'|'kyc_pending'|'needs_info'|'kyc_approved'|'decision_pending'|'approved'|'rejected'|'signed'|'active'|'closed';
export type Bot={id:string;label:string;username:string;enabled:boolean;envKey:string};
export type Entry={id:string;loanId:string;kind:string;cents:number;debit:string;credit:string;at:string};
export type Event={id:string;loanId:string;action:string;role:Role;note:string;at:string};
export type Loan={billing?:Bill;billConfirmedAt?:string;approvalActor?:string;approvalCheckedBy?:string;fundingActor?:string;fundingCheckedBy?:string;id:string;customerId?:string;kycCaseId?:string;kycRevision?:number;phoneMasked?:string;name:string;botId:string;amount:number;fee:number;status:Status;createdAt:string;dueAt?:string;signedAt?:string;signature?:string;contract?:string;paid:number;wallet:number;note:string;demoDays:number;kyc:{income:number;contacts:string[];document:string}};
export type State={activeBotId?:string;postloan?:Postloan;loans:Loan[];bots:Bot[];events:Event[];entries:Entry[];notifications:{id:string;loanId:string;botId:string;text:string;at:string;status:string}[];requests:string[]};
export function businessBot(s:State){return s.activeBotId?s.bots.find(b=>b.id===s.activeBotId&&b.enabled):s.bots.find(b=>b.enabled)}
export const statusNames:Record<Status,string>={registered:'已注册 · 待 KYC',kyc_pending:'待资料审核',needs_info:'待补件',kyc_approved:'资料通过',decision_pending:'待机构审批',approved:'待签约',rejected:'申请未通过',signed:'待放款',active:'还款中',closed:'已结清'};
export const initialState=():State=>({loans:[],bots:[{id:'bot-1',label:'PayEase 主机器人',username:'',enabled:true,envKey:'TELEGRAM_BOT_TOKEN_1'},{id:'bot-2',label:'PayEase 第二机器人',username:'',enabled:true,envKey:'TELEGRAM_BOT_TOKEN_2'}],events:[],entries:[],notifications:[],requests:[]});
export const roles:Record<string,Role>={create:'mini',confirm_kyc:'mini',submit_kyc:'mini',resubmit:'mini',apply:'mini',sign:'mini',withdraw:'mini',repay:'mini',review:'ops',supplement:'ops',approve:'lender',reject:'lender',disburse:'lender',overdue:'ops',bot_save:'ops',bot_add:'ops',bot_switch:'ops'};
export function applyAction(input:State,p:any,now=new Date().toISOString()):State{
 if(!p||typeof p!=='object'||!roles[p.action]||roles[p.action]!==p.role)throw Error('此操作不属于当前演示角色');
 if(typeof p.requestId!=='string'||p.requestId.length<8||p.requestId.length>100)throw Error('请求编号无效');
 if(input.requests.includes(p.requestId))return input;
 const s:State=structuredClone(input); const id=()=>crypto.randomUUID();
 const text=(v:unknown,max=120)=>typeof v==='string'?v.trim().slice(0,max):'';
 if(p.action==='bot_switch'){
  const bot=s.bots.find(b=>b.id===p.botId&&b.enabled);if(!bot)throw Error('请选择已启用的机器人');
  if(p.previousBotId!==businessBot(s)?.id)throw Error('业务渠道已变化，请刷新后重试');
  const previous=businessBot(s);s.activeBotId=bot.id;s.events.unshift({id:id(),loanId:'渠道',action:p.action,role:p.role,note:'业务机器人从 '+(previous?.label||'未设置')+' 切换为 '+bot.label+'；仅用于新申请',at:now});
 }else if(p.action==='bot_add'){
  if(s.bots.length>=10)throw Error('测试空间最多配置 10 个机器人');
  const n=s.bots.length+1;s.bots.push({id:'bot-'+n,label:'PayEase 机器人 '+n,username:'',enabled:true,envKey:'TELEGRAM_BOT_TOKEN_'+n});
  s.events.unshift({id:id(),loanId:'渠道',action:'bot_add',role:'ops',note:'新增机器人渠道 '+n,at:now});
 }else if(p.action==='bot_save'){
  const bot=s.bots.find(b=>b.id===p.botId); if(!bot)throw Error('机器人不存在');
  const label=text(p.label,50);if(!label)throw Error('请填写机器人名称');
  const username=text(p.username,40).replace(/^@/,''); if(username&&!/^[A-Za-z0-9_]{5,32}bot$/i.test(username))throw Error('机器人用户名须为有效的 bot 用户名');
  if(username&&s.bots.some(b=>b.id!==bot.id&&b.username.toLowerCase()===username.toLowerCase()))throw Error('两个机器人必须使用不同用户名');
  if(!p.enabled&&businessBot(s)?.id===bot.id)throw Error('请先切换业务机器人，再停用当前渠道');
  bot.label=label;bot.username=username;bot.enabled=p.enabled===true;
  s.events.unshift({id:id(),loanId:'渠道',action:p.action,role:p.role,note:label+' 配置已更新',at:now});
 }else if(p.action==='create'){
  if(s.loans.length>=100)throw Error('测试空间最多保存 100 笔申请');
  p={...p,botId:businessBot(s)?.id};if(!p.botId)throw Error('暂无可用业务机器人，请联系管理员');
  const amount=Number(p.amount);if(![3000,5000,10000].includes(amount))throw Error('请选择 30、50 或 100 USD 测试额度');
  const name=text(p.name,50);if(name.length<2)throw Error('请填写测试姓名');
  if(p.consent!==true)throw Error('请先确认测试资料授权');
  const loan:Loan={id:id(),name,botId:p.botId,amount,fee:200,status:'registered',createdAt:now,paid:0,wallet:0,note:'注册完成，请继续提交测试 KYC',demoDays:0,kyc:{income:30000,contacts:['演示亲属 · TEST-001','演示朋友 · TEST-002'],document:'示例身份证与收入证明（合成测试资料）'}};
  s.loans.unshift(loan);s.events.unshift({id:id(),loanId:loan.id,action:'create',role:'mini',note:'测试用户注册完成',at:now});
 }else{
  const l=s.loans.find(l=>l.id===p.loanId);if(!l)throw Error('申请不存在');
  const needs=(states:Status[])=>{if(!states.includes(l.status))throw Error('申请状态已变化，请刷新后重试')};
  const note=text(p.note);
  const journal=(kind:string,cents:number,debit:string,credit:string)=>s.entries.push({id:id(),loanId:l.id,kind,cents,debit,credit,at:now});
  switch(p.action){
   case 'confirm_kyc':needs(['registered','kyc_pending','needs_info']);if(!l.customerId)throw Error('仅适用于 H5 客户');l.status='kyc_pending';l.note='等待确认人工审核结果';break;
   case 'submit_kyc':needs(['registered']);if(p.consent!==true)throw Error('请确认测试 KYC 资料授权');l.status='kyc_pending';l.note='测试 KYC 已提交审核';break;
   case 'review':needs(['kyc_pending']);l.status='kyc_approved';l.note='资料审核通过，可以申请贷款';break;
   case 'supplement':needs(['kyc_pending']);if(!note)throw Error('请填写补件原因');l.status='needs_info';l.note=note;break;
   case 'resubmit':needs(['needs_info']);l.status='kyc_pending';l.note='测试补充材料已提交';break;
   case 'apply':needs(['kyc_approved']);if(l.billing&&(p.billConfirmed!==true||p.quoteId!==l.billing.quoteId))throw Error('请核对并确认当前结算账单后提交');if(l.billing)l.billConfirmedAt=now;l.status='decision_pending';l.note='申请已送交测试机构';break;
   case 'approve':needs(['decision_pending']);l.status='approved';l.note='机构已批准，等待用户确认费用与签约';break;
   case 'reject':needs(['decision_pending']);if(!note)throw Error('请填写拒绝原因');l.status='rejected';l.note=note;break;
   case 'sign':needs(['approved']);if(p.consent!==true||text(p.signature,50).length<2)throw Error('请确认协议并输入测试签名');
    l.status='signed';l.signedAt=now;l.signature=text(p.signature,50);l.contract=JSON.stringify({version:'sandbox-v1',currency:'USD',principal:l.amount,fee:l.fee,net:l.amount,total:l.amount+l.fee,termDays:14,signature:l.signature,acceptedAt:now,notice:'仅测试资金，不产生真实借贷合同'});l.note='测试协议已确认，等待机构放款';break;
   case 'disburse':needs(['signed']);l.status='active';l.wallet=l.billing?.net??l.amount;l.dueAt=new Date(Date.parse(now)+(l.billing?.termDays??14)*86400000).toISOString();l.note='测试资金已放款至钱包';journal('测试放款',l.billing?.net??l.amount,'loan_receivable','funding_cash');if(l.billing?.upfront)journal('放款预扣费用',l.billing.upfront,'loan_receivable','fee_revenue');if(l.fee)journal('到期费用',l.fee,'loan_receivable','fee_revenue');break;
   case 'withdraw':needs(['active','closed']);if(l.wallet<=0)throw Error('钱包没有可提现的测试余额');l.note='测试提现 '+(l.wallet/100).toFixed(2)+' USD 已完成（无真实转账）';journal('测试提现',l.wallet,'wallet_withdrawal','wallet_available');l.wallet=0;break;
   case 'repay':needs(['active']);{
    const cents=Number(p.cents),left=l.amount+l.fee-l.paid;if(!Number.isSafeInteger(cents)||cents<=0||cents>left)throw Error('还款金额须大于零且不超过剩余应还');
    l.paid+=cents;journal('测试还款',cents,'funding_cash','loan_receivable');l.note='测试还款 '+(cents/100).toFixed(2)+' USD 已入账';
    if(l.paid===l.amount+l.fee){l.status='closed';l.note='贷款已全部结清'}break;
   }
   case 'overdue':needs(['active']);if(![0,3,4,16].includes(Number(p.days)))throw Error('请选择有效的测试逾期天数');l.demoDays=Number(p.days);l.note='已设置测试逾期情景 '+l.demoDays+' 天';break;
   default:throw Error('未知操作');
  }
  s.events.unshift({id:id(),loanId:l.id,action:p.action,role:p.role,note:l.note+(note&&note!==l.note?' · '+note:''),at:now});
  s.notifications.unshift({id:id(),loanId:l.id,botId:l.botId,text:l.note,at:now,status:'模拟已记录 · 未发送 Telegram'});
 }
 syncSettlements(s,now);s.requests.push(p.requestId);return s;
}
export function summary(s:State){return {applications:s.loans.length,active:s.loans.filter(l=>l.status==='active').length,closed:s.loans.filter(l=>l.status==='closed').length,disbursed:s.entries.filter(e=>e.kind==='测试放款').reduce((n,e)=>n+e.cents,0),repaid:s.entries.filter(e=>e.kind==='测试还款').reduce((n,e)=>n+e.cents,0)}}

export function customerState(state:State,customerId:string):State{
 const loans=state.loans.filter(l=>l.customerId===customerId),ids=new Set(loans.map(l=>l.id));
 return {...state,postloan:undefined,loans,bots:state.bots.filter(b=>b.enabled).map(b=>({...b,envKey:''})),events:state.events.filter(e=>ids.has(e.loanId)),entries:state.entries.filter(e=>ids.has(e.loanId)),notifications:state.notifications.filter(e=>ids.has(e.loanId)),requests:[]};
}
export function customerAction(state:State,input:any,customer:{id:string;phoneMasked:string}):State{
 if(!input||roles[input.action]!=='mini'||input.role&&input.role!=='mini')throw Error('客户会话无权执行此操作');
 if(input.action!=='create'&&!state.loans.some(l=>l.id===input.loanId&&l.customerId===customer.id))throw Error('申请不存在或不属于当前客户');
 if(typeof input.requestId!=='string'||input.requestId.length<8||input.requestId.length>100)throw Error('请求编号无效');
 const p={...input,role:'mini',requestId:customer.id.slice(0,16)+':'+input.requestId.slice(0,80)};
 const next=applyAction(state,p);if(next===state)return state;
 if(p.action==='create'){next.loans[0].customerId=customer.id;next.loans[0].phoneMasked=customer.phoneMasked;next.loans[0].kyc={income:0,contacts:[],document:'身份资料单独提交并由授权人员人工审核'};next.loans[0].note='注册完成，请填写身份资料并等待人工审核'}
 return next;
}
