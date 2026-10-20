import { Preferences } from '@capacitor/preferences';
import { readConfig } from './config.js';
export const CONNECTION_KEY='nu_public_connection_v1';
let current={ready:false,unsafe:false,source:'none'};
export const getRuntimeConfig=()=>current;
export function toConfig(values={}) {
 return readConfig({VITE_SUPABASE_URL:values.supabaseUrl||'',VITE_SUPABASE_PUBLISHABLE_KEY:values.supabasePublishableKey||''});
}
export function configDocument(config) {
 if(!config?.ready||config.unsafe)throw Error('Informe uma URL válida e uma chave pública publishable ou anon.');
 return{version:1,supabaseUrl:config.url,supabasePublishableKey:config.key};
}
export async function loadRuntimeConfig({env={},preferences=Preferences,fetcher=globalThis.fetch,baseUrl=globalThis.document?.baseURI||'http://localhost/'}={}) {
 const environment=readConfig(env);
 if(environment.unsafe){current={...environment,source:'environment'};return current;}
 let remembered=null;
 try{const{value}=await preferences.get({key:CONNECTION_KEY});if(value)remembered=toConfig(JSON.parse(value));}catch{}
 if(remembered?.ready){current={...remembered,source:'device'};return current;}
 if(environment.ready){current={...environment,source:'environment'};return current;}
 let fileConfig=null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetcher(new URL('./config.json',baseUrl).href,{cache:'no-store',signal:controller.signal});
  if(response.ok)fileConfig=toConfig(await response.json());
 }catch{}finally{clearTimeout(timer);}
 current=fileConfig?.ready||fileConfig?.unsafe?{...fileConfig,source:'file'}:{ready:false,unsafe:false,source:'none'};
 return current;
}
export async function saveRuntimeConfig(config,preferences=Preferences) {
 const data=configDocument(config);
 await preferences.set({key:CONNECTION_KEY,value:JSON.stringify(data)});
}
export async function clearRuntimeConfig(preferences=Preferences){await preferences.remove({key:CONNECTION_KEY});}
