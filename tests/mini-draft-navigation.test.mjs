import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
test('real Mini provider lets KYC pause button navigation and resume exactly its requested route',()=>{
 const navigation=[],events=[],jsx=(type,props)=>({type,props});
 const mocks={react:{createContext:()=>({Provider:'provider'})},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{},'lucide-react':{},'@/lib/i18n':{},'@/lib/analytics':{},'@/lib/api-client':{}};
 const exports={},js=ts.transpileModule(readFileSync('components/mini-shell.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext('(function(exports,require){'+js+'\n})',{CustomEvent,window:{dispatchEvent(event){events.push(event);event.preventDefault();return !event.defaultPrevented}}})(exports,n=>mocks[n]);
 const tree=exports.MiniNavigationProvider({navigate:href=>navigation.push(href),children:null});tree.props.value('/h5/records');
 assert.equal(navigation.length,0);assert.equal(events[0].type,'payease:before-navigate');assert.equal(events[0].detail.href,'/h5/records');events[0].detail.resume();assert.deepEqual(navigation,['/h5/records']);
});
