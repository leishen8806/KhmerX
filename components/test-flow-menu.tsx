'use client';
import {Menu,LogIn,ShieldCheck,Wallet,BriefcaseBusiness,Building2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator} from '@/components/ui/dropdown-menu';
const entries=[{label:'注册登录',href:'/h5/login',icon:LogIn},{label:'KYC资料',href:'/h5/kyc',icon:ShieldCheck},{label:'贷款流程',href:'/h5',icon:Wallet},{label:'业务协作平台',href:'/team?queue=kyc',icon:BriefcaseBusiness},{label:'机构协作平台',href:'/team?queue=loans',icon:Building2}];
export function TestFlowMenu(){return <div className="test-flow-toolbar"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" aria-label="切换测试流程"><Menu size={16}/>测试流程</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="test-flow-menu"><DropdownMenuLabel>切换测试流程</DropdownMenuLabel><DropdownMenuSeparator/>{entries.map(({label,href,icon:Icon})=><DropdownMenuItem asChild key={label}><a href={href}><Icon size={16}/>{label}</a></DropdownMenuItem>)}<DropdownMenuSeparator/><p className="fine">页面切换不变更账号与岗位权限。</p></DropdownMenuContent></DropdownMenu></div>}
