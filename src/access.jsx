import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { ArrowRight,ShieldCheck,ArrowUpRight,WalletCards,HeartHandshake,Eye,EyeOff } from 'lucide-react';
import { Brand,Button,Message,Loader } from './ui.jsx';
import { useAuth } from './auth.jsx';
import { supabase,config } from './client.js';
import { friendlyError } from './api.js';
export function Access(){
 const {actions,notice}=useAuth();const[mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 function changeMode(next){setMode(next);setError('');setSuccess('');setPassword('');}
 async function submit(e){
  e.preventDefault();setError('');setSuccess('');setBusy(true);
  try{
   if(mode==='signup'){
    if(name.trim().length<2)throw Error('Informe um nome com pelo menos 2 caracteres.');
    const result=await actions.signUp(name,email,password);
    if(result.needsConfirmation){changeMode('login');setSuccess('Conta criada! Confirme o e-mail enviado pelo Supabase e entre com sua senha do projeto.');}
   }else if(mode==='reset'){
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),Capacitor.isNativePlatform()?{}:{redirectTo:location.origin});if(error)throw error;
    setSuccess('Se esse endereço estiver cadastrado, você receberá o link de recuperação. Confira também o spam.');
   }else await actions.signIn(email,password);
  }catch(e){setError(friendlyError(e));}finally{setBusy(false);setPassword('');}
 }
 return <main className="access"><section className="access-hero"><Brand/><div className="hero-copy"><span className="hero-kicker">SEU BANCO, EM VERSÃO ACADÊMICA</span><h1>Sua vida financeira.<br/><span>Mais leve.<br/>Mais roxa.</span></h1><p>Uma experiência completa para aprender a cuidar do dinheiro. Tudo em um só lugar.</p><div className="hero-benefits"><span><ShieldCheck size={19}/> Sessão persistente</span><span><WalletCards size={19}/> Conta e cartões</span><span><HeartHandshake size={19}/> Feito para aprender</span></div></div><div className="hero-card"><span className="nu-word">nu</span><span className="card-chip"/><span className="hero-card-bottom">CARTÃO ACADÊMICO <ArrowUpRight size={24}/></span></div><small className="hero-footer">SENAI · PPDM2 · Sessões seguras no híbrido</small></section>
 <section className="access-panel"><div className="academic-banner">Projeto acadêmico independente · dinheiro fictício</div><div className="access-form"><span className="eyebrow">BEM-VINDO AO PROJETO</span><h2>{mode==='signup'?'Vamos abrir sua conta?':mode==='reset'?'Recuperar acesso':'Bom ter você de volta.'}</h2><p className="subtle">{mode==='signup'?'Crie uma conta exclusiva deste projeto.':mode==='reset'?'Informe o e-mail que você cadastrou aqui.':'Entre para acessar seu banco acadêmico.'}</p>{mode!=='reset'&&<div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>changeMode('login')}>Entrar</button><button className={mode==='signup'?'active':''} onClick={()=>changeMode('signup')}>Criar conta</button></div>}
 <Message>{error||notice}</Message><Message type="success">{success}</Message>
 <form onSubmit={submit}>{mode==='signup'&&<label>Como podemos chamar você?<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={80} autoComplete="name" placeholder="Seu nome" required disabled={busy}/></label>}
 <label>E-mail do projeto<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="voce@exemplo.com" required disabled={busy}/></label>
 {mode!=='reset'&&<label>Senha do projeto<span className="password-input"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==='signup'?8:1} autoComplete={mode==='signup'?'new-password':'current-password'} placeholder={mode==='signup'?'Crie uma senha com 8 caracteres ou mais':'Sua senha neste projeto'} required disabled={busy}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar senha':'Mostrar senha'}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>}
 {mode==='login'&&<button type="button" className="text-button forgot" onClick={()=>changeMode('reset')}>Esqueci minha senha</button>}
 <Button className="wide" busy={busy} icon={ArrowRight} type="submit">{mode==='signup'?'Criar minha conta acadêmica':mode==='reset'?'Enviar link de recuperação':'Acessar minha conta'}</Button></form>
 {mode==='reset'&&<button className="text-button" onClick={()=>changeMode('login')}>Voltar para o login</button>}
 <p className="access-note"><ShieldCheck size={17}/>Use uma senha exclusiva para o projeto. Não informe sua senha do Nubank.</p><p className="legal-note">Este projeto não é operado pelo Nubank e não movimenta dinheiro real.</p><a className="configure-link" href="?configurar=1">Configurar conexão com Supabase</a></div></section></main>;
}
export { Setup } from './setup.jsx';
export function AuthSplash({signingOut=false}){return <main className="splash"><Brand/><Loader label={signingOut?'Encerrando a sessão…':'Recuperando sua sessão com segurança…'}/></main>;}
export function Recovery(){const{notice,actions}=useAuth();const[busy,setBusy]=useState(false);return <main className="setup-screen"><Brand/><section className="setup-card"><h1>Vamos recuperar sua conexão.</h1><Message>{notice}</Message><Button busy={busy} onClick={async()=>{setBusy(true);try{await actions.retry();}finally{setBusy(false);}}}>Tentar novamente</Button></section></main>;}
export function PasswordForm({onDone}){
 const[pw,setPw]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();setError('');setSuccess('');if(pw!==confirm){setError('As senhas precisam ser iguais.');return;}setBusy(true);try{const{error}=await supabase.auth.updateUser({password:pw});if(error)throw error;setPw('');setConfirm('');setSuccess('Senha do projeto atualizada.');onDone?.();}catch(e){setError(friendlyError(e));}finally{setBusy(false);}}}><Message>{error}</Message><Message type="success">{success}</Message><label>Nova senha do projeto<input type="password" value={pw} onChange={e=>setPw(e.target.value)} minLength={8} autoComplete="new-password" required disabled={busy}/></label><label>Repita a nova senha<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" required disabled={busy}/></label><Button type="submit" busy={busy}>Atualizar senha</Button></form>;
}
export function PasswordRecovery(){const{actions}=useAuth();return <main className="setup-screen"><Brand/><section className="setup-card"><h1>Escolha sua nova senha.</h1><p>Esta senha vale apenas para o projeto acadêmico.</p><PasswordForm onDone={()=>actions.finishRecovery()}/><button className="text-button" onClick={()=>actions.finishRecovery()}>Continuar para minha conta</button></section></main>;}
