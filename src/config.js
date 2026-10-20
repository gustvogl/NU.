export function readConfig(env = {}) {
 const url = (env.VITE_SUPABASE_URL || '').trim();
 const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
 const missing = !url || !key || /SEU-PROJETO|SUA_CHAVE/.test(url + key);
 let publicKey = key.startsWith('sb_publishable_');
 if (key.startsWith('eyJ')) {
  try { publicKey = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'anon'; } catch {}
 }
 if (key && !/SUA_CHAVE/.test(key) && !publicKey) return { ready:false, unsafe:true };
 if (missing) return { ready:false, unsafe:false };
 try {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw Error();
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))) throw Error();
  return { ready:true, url:parsed.origin, key };
 } catch { return { ready:false, unsafe:false }; }
}
