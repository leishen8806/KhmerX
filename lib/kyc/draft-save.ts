export type DraftState='saved'|'pending'|'saving'|'failed'|'conflict';
/** One revision stream; accepting an older save never replaces later input. */
export class DraftSaver<P,R extends {revision:number;profile:P}>{
 private revision=0;private latest!:P;private sequence=0;private saved=0;private enabled=false;
 private timer?:ReturnType<typeof setTimeout>;private flight?:Promise<R|undefined>;
 private state:DraftState='saved';private conflict=false;private generation=0;
 private send:(profile:P,revision:number,action:'save'|'submit')=>Promise<R>;
 private status:(state:DraftState)=>void;private accepted:(result:R,clean:boolean)=>void;
 constructor(send:DraftSaver<P,R>['send'],status:DraftSaver<P,R>['status'],accepted:DraftSaver<P,R>['accepted']){this.send=send;this.status=status;this.accepted=accepted}
 get dirty(){return this.sequence!==this.saved}
 private mark(state:DraftState){this.state=state;this.status(state)}
 reset(revision:number,profile:P,enabled:boolean){this.dispose();this.revision=revision;this.latest=profile;this.enabled=enabled;this.sequence=0;this.saved=0;this.conflict=false;this.mark('saved')}
 edit(profile:P){
  this.latest=profile;if(!this.enabled)return;this.sequence++;
  if(this.timer)clearTimeout(this.timer);
  if(this.conflict||this.state==='failed')return;
  this.mark(this.flight?'saving':'pending');
  this.timer=setTimeout(()=>{void this.flush().catch(()=>undefined)},1500);
 }
 async flush(action:'save'|'submit'='save'):Promise<R|undefined>{
  const generation=this.generation;
  if(this.timer)clearTimeout(this.timer);
  let completed:R|undefined;while(this.flight)completed=await this.flight;
  if(generation!==this.generation)return undefined;
  if(this.conflict)throw {status:409};
  if(!this.enabled)return undefined;
  if(action==='save'&&!this.dirty)return completed;
  const sequence=this.sequence,profile=this.latest;this.mark('saving');
  this.flight=this.send(profile,this.revision,action).then(result=>{
   if(generation!==this.generation)return undefined;
   this.revision=result.revision;this.saved=sequence;
   const clean=!this.dirty;if(clean)this.latest=result.profile;
   this.accepted(result,clean);this.mark(clean?'saved':'pending');return result;
  }).catch(error=>{if(generation!==this.generation)return undefined;if(this.timer)clearTimeout(this.timer);this.conflict=error?.status===409;this.mark(this.conflict?'conflict':'failed');throw error}).finally(()=>{if(generation===this.generation)this.flight=undefined});
  return this.flight;
 }
 dispose(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.enabled=false;this.generation++;this.flight=undefined}
}
