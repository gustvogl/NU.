import { createContext,useContext,useEffect,useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { supabase,config } from './client.js';
import { createSessionController } from './session-controller.js';
import { createSessionStorage } from './session-storage.js';
let callback=null;
if(typeof window!=='undefined' && /(?:^#|&)access_token=/.test(location.hash)){
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.get('type')==='recovery' && params.get('access_token') && params.get('refresh_token'))callback={recovery:true,session:{access_token:params.get('access_token'),refresh_token:params.get('refresh_token')}};
 history.replaceState(null,'',location.pathname+location.search);
}
export const controller=supabase?createSessionController({auth:supabase.auth,storage:createSessionStorage(undefined,config.url),callback}):null;
const AuthContext=createContext(null);
const unconfigured={status:'unconfigured',session:null};
const emptySubscribe=()=>()=>{},emptySnapshot=()=>unconfigured;
export function AuthProvider({children}){
 const state=useSyncExternalStore(controller?.subscribe||emptySubscribe,controller?.getSnapshot||emptySnapshot,controller?.getSnapshot||emptySnapshot);
 useEffect(()=>{controller?.initialize();},[]);
 useEffect(()=>{
  if(!Capacitor.isNativePlatform()||state.status!=='authenticated')return;
  let disposed=false,handle;
  const apply=({isActive})=>{if(!disposed)(isActive?supabase.auth.startAutoRefresh():supabase.auth.stopAutoRefresh());};
  NativeApp.addListener('appStateChange',apply).then(h=>{handle=h;if(disposed)h.remove();}).catch(()=>{});
  NativeApp.getState().then(apply).catch(()=>{});
  return()=>{disposed=true;handle?.remove();supabase.auth.stopAutoRefresh();};
 },[state.status]);
 return <AuthContext.Provider value={{...state,actions:controller}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
if(import.meta.hot)import.meta.hot.dispose(()=>{controller?.dispose();supabase?.auth.stopAutoRefresh();});
