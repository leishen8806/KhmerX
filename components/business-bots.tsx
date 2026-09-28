'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {businessBot,type State,type Bot} from '@/lib/domain';
import {tokenKey} from '@/lib/notifications/core';
export function BusinessBots({state,tenant,busy,post}:{state:State;tenant:string;busy:boolean;post:any}){
 const current=businessBot(state);
 const save=(action:string,values:any={})=>post({action,...values,requestId:crypto.randomUUID()},'/api/state');
 return <section className="panel"><h2>Telegram 业务渠道</h2><p>当前业务机器人：<strong>{current?.label||'未设置'}</strong></p><p>由公司管理员切换，新申请自动使用当前机器人。已有申请保留原渠道；通知仍需客户在对应机器人内同意订阅。</p><div className="bot-grid">{state.bots.map(bot=><Channel key={bot.id} bot={bot} tenant={tenant} current={current?.id} busy={busy} save={save}/>)}</div><Button variant="outline" disabled={busy||state.bots.length>=10} onClick={()=>void save('bot_add')}>新增机器人</Button></section>
}
function Channel({bot,tenant,current,busy,save}:{bot:Bot;tenant:string;current?:string;busy:boolean;save:any}){
 const [label,setLabel]=useState(bot.label),[username,setUsername]=useState(bot.username),[enabled,setEnabled]=useState(bot.enabled);
 const dirty=label!==bot.label||username!==bot.username||enabled!==bot.enabled;
 return <article className="bot-card"><h3>{bot.label} {current===bot.id&&<span className="pill">当前业务</span>}</h3><div className="form"><label>渠道名称<Input value={label} maxLength={50} onChange={e=>setLabel(e.target.value)}/></label><label>机器人用户名<Input value={username} maxLength={40} placeholder="your_payease_bot" onChange={e=>setUsername(e.target.value)}/></label><label className="check"><input type="checkbox" disabled={busy||current===bot.id} checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>启用渠道</label><div className="button-row"><Button disabled={busy||!dirty||!label.trim()} onClick={()=>void save('bot_save',{botId:bot.id,label,username,enabled})}>保存配置</Button><Button variant="outline" disabled={busy||dirty||!bot.enabled||current===bot.id} onClick={()=>void save('bot_switch',{botId:bot.id,previousBotId:current})}>{current===bot.id?'当前业务机器人':'切换为业务机器人'}</Button></div>{dirty&&<p className="fine">请先保存配置，再切换业务。</p>}<details><summary>连接配置</summary><p className="fine">请将该机器人的 Token 安全配置到服务端；填写用户名不会建立真实连接。</p><code style={{overflowWrap:'anywhere'}}>{tokenKey(tenant,bot.id)}</code></details></div></article>
}
