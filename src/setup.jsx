import { useState } from 'react';
import { ArrowRight,CheckCircle2,Download,Copy,Database,Link,ShieldCheck,RefreshCw } from 'lucide-react';
import { Brand,Button,Message,downloadText } from './ui.jsx';
import { config } from './client.js';
import { toConfig,configDocument,saveRuntimeConfig,clearRuntimeConfig } from './runtime-config.js';
import { checkConnection } from './connection-check.js';
export function Setup(){
 const[url,setUrl]=useState(config.ready?config.url:''),[key,setKey]=useState(config.ready?config.key:''),[busy,setBusy]=useState(false),[copying,setCopying]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[tested,setTested]=useState(null);
 function change(setter,value){setter(value);setTested(null);setError('');setNotice('');}
 async function connect(e){
  e.preventDefault();setError('');setNotice('');setTested(null);
  const next=toConfig({supabaseUrl:url.trim(),supabasePublishableKey:key.trim()});
  if(!next.ready){setError(next.unsafe?'Essa chave é secreta. Use apenas publishable ou anon; nunca secret ou service_role.':'Confira a URL HTTPS do projeto e a chave pública.');return;}
  setBusy(true);
  try{await checkConnection(next);await saveRuntimeConfig(next);setTested(next);setNotice('Banco verificado e conexão salva neste dispositivo. Você já pode entrar.');}
  catch(e){setError(e.message||'Não foi possível conectar. Confira os dados e tente novamente.');}
  finally{setBusy(false);}
 }
 async function copySql(){setCopying(true);setError('');try{const r=await fetch(new URL('./setup.sql',document.baseURI),{cache:'no-store'});if(!r.ok)throw Error();const sql=await r.text();if(!sql.includes('nu_schema_status'))throw Error();await navigator.clipboard.writeText(sql);setNotice('SQL copiado. Cole no SQL Editor do seu Supabase e clique em Run.');}catch{setError('Não foi possível copiar. Use Baixar SQL e abra o arquivo baixado.');}finally{setCopying(false);}}
 function downloadConfiguration(){const c=tested||toConfig({supabaseUrl:url.trim(),supabasePublishableKey:key.trim()});try{downloadText('config.json',JSON.stringify(configDocument(c),null,2)+'\n','application/json;charset=utf-8');}catch(e){setError(e.message);}}
 function enter(){const target=new URL(location.href);target.searchParams.delete('configurar');target.hash='';location.replace(target.href);}
 return <main className="setup-screen direct-setup"><Brand/><section className="setup-card direct-card"><span className="eyebrow">CONFIGURAÇÃO RÁPIDA</span><h1>Conecte seu banco.</h1><p>Execute o SQL, cole os dados do seu Supabase e comece a usar.</p>
 <div className="connect-step"><span className="step-number">1</span><div><h2>Crie as tabelas com um único SQL</h2><p>Abra o SQL Editor do seu Supabase, cole o arquivo completo e clique em Run. Se já usou a versão anterior, execute novamente para atualizar sem apagar seus dados.</p><div className="setup-actions"><a className="button secondary" href="./setup.sql" download="01-banco.sql"><Download size={17}/>Baixar SQL</a><Button className="secondary" type="button" icon={Copy} busy={copying} onClick={copySql}>Copiar SQL</Button></div></div></div>
 <div className="connect-step"><span className="step-number">2</span><div className="connection-fields"><h2>Conecte ao seu projeto</h2><p>Copie a Project URL e a chave pública no painel do Supabase.</p><form onSubmit={connect}><label>URL do Supabase<input type="url" value={url} onChange={e=>change(setUrl,e.target.value)} placeholder="https://seu-projeto.supabase.co" required disabled={busy} autoCapitalize="none" autoComplete="off" spellCheck={false}/></label><label>Chave pública (publishable ou anon)<textarea value={key} onChange={e=>change(setKey,e.target.value)} placeholder="sb_publishable_..." required disabled={busy} autoCapitalize="none" autoComplete="off" spellCheck={false} rows={3}/></label><Message>{error||(!tested&&config.unsafe?'A configuração atual contém uma chave secreta. Substitua pela chave pública.':'')}</Message><Message type="success">{notice}</Message>
 {!tested?<Button className="wide" type="submit" icon={Database} busy={busy}>Testar e conectar</Button>:<div className="connected-actions"><Button className="wide" type="button" icon={ArrowRight} onClick={enter}>Entrar no banco</Button><Button className="secondary wide" type="button" icon={Download} onClick={downloadConfiguration}>Baixar config.json para publicar</Button></div>}
 </form></div></div>
 <div className="publish-tip"><ShieldCheck size={21}/><div><strong>Quer deixar pronto para todos?</strong><p>Depois de testar a conexão, baixe o config.json e substitua o arquivo de mesmo nome na pasta PRONTO-PARA-PUBLICAR. Publique o conteúdo dessa pasta na Vercel.</p><p>Esta tela salva a conexão neste dispositivo. O config.json conecta os visitantes ao mesmo banco automaticamente.</p></div></div>
 <div className="setup-footer">{config.ready&&<button className="text-button" onClick={enter}>Voltar ao banco</button>}<button className="text-button" disabled={busy} onClick={async()=>{try{await clearRuntimeConfig();location.reload();}catch{setError('Não foi possível limpar a configuração do dispositivo.');}}}>Usar configuração publicada</button></div>
 </section><span className="legal-note">Projeto acadêmico independente · valores fictícios · sem vínculo com o Nubank</span></main>;
}
