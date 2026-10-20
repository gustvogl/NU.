import { credentials,InvalidStoredSession } from './session-storage.js';
export function createSessionController({auth,storage,callback=null}) {
 let state={status:'loading',session:null,source:null,notice:'',lastSavedAt:null,passwordRecovery:false};
 let queue=Promise.resolve(),revision=0,booting=true,bootstrapPromise,subscription,failedWrite=null;
 const listeners=new Set();
 function publish(patch){state={...state,...patch};for(const fn of listeners)fn();}
 function enqueue(event,session,source=state.source||'login'){
  const rev=++revision;
  if(event==='SIGNED_OUT')publish({status:'signing-out',session:null,passwordRecovery:false});
  queue=queue.then(async()=>{
   try{if(session)await storage.save(session);else await storage.remove();
    failedWrite=null;
    if(rev===revision)publish({status:booting?'loading':session?'authenticated':'anonymous',session,source:session?source:null,notice:'',lastSavedAt:session?new Date().toISOString():null});
   }catch{if(rev===revision){failedWrite={event,session,source};publish({status:'storage-error',session:null,notice:'Não foi possível salvar a sessão no dispositivo. Tente novamente.'});}}
  });
 }
 function listen(){
  if(subscription)return;
  subscription=auth.onAuthStateChange((event,session)=>{
   if(['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED','PASSWORD_RECOVERY'].includes(event)&&session){
    if(event==='PASSWORD_RECOVERY')publish({passwordRecovery:true});
    enqueue(event,session,booting?'restored':state.source||'login');
   }else if(event==='SIGNED_OUT')enqueue(event,null);
  }).data.subscription;
 }
 async function bootstrap(){
  booting=true;publish({status:'loading',notice:''});listen();
  try{
   const saved=callback?.session || await storage.read();
   if(!saved){booting=false;publish({status:'anonymous',session:null});return;}
   const result=await auth.setSession(credentials(saved));
   if(result.error)throw result.error;
   if(!result.data.session)throw new InvalidStoredSession();
   await queue;booting=false;
   if(state.status!=='storage-error')publish({status:'authenticated',session:result.data.session,source:'restored',passwordRecovery:!!callback?.recovery});
   callback=null;
  }catch(error){
   booting=false;
   if(error instanceof InvalidStoredSession || (error.status>=400 && error.status<500 && error.status!==429)){
    enqueue('SIGNED_OUT',null);await queue;
    if(state.status!=='storage-error')publish({status:'anonymous',notice:'Sua sessão expirou. Entre novamente.'});
   }else publish({status:'recovery-error',session:null,notice:'Não foi possível recuperar a sessão. Confira a conexão e tente novamente; os tokens foram preservados.'});
  }
 }
 function assertSaved(){if(state.status==='storage-error')throw Error(state.notice);}
 return {
  getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
  initialize(){if(!bootstrapPromise)bootstrapPromise=bootstrap().finally(()=>{bootstrapPromise=null;});return bootstrapPromise;},
  async signIn(email,password){const {data,error}=await auth.signInWithPassword({email:email.trim(),password});if(error)throw error;if(!data.session)throw Error('Não foi possível iniciar a sessão.');await queue;assertSaved();},
  async signUp(name,email,password){const {data,error}=await auth.signUp({email:email.trim(),password,options:{data:{name:name.trim()}}});if(error)throw error;await queue;assertSaved();return{needsConfirmation:!data.session};},
  async signOut(){const previous=state;publish({status:'signing-out',session:null});const {error}=await auth.signOut({scope:'local'});if(error){publish(previous);throw error;}await queue;assertSaved();},
  async retry(){if(failedWrite){booting=false;const op=failedWrite;enqueue(op.event,op.session,op.source);await queue;}else await this.initialize();},
  finishRecovery(){publish({passwordRecovery:false});},
  flush:()=>queue,dispose(){subscription?.unsubscribe();listeners.clear();}
 };
}
