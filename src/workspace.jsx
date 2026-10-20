import { useCallback,useEffect,useRef,useState } from 'react';
import { Home,Layers,ArrowUpDown,CreditCard,Target,FileText,Landmark,UserRound,HelpCircle,LogOut,Bell,RefreshCw,Menu,X,ChevronRight,CheckCircle2,ShieldCheck } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { initializeAccount,loadDashboard,friendlyError } from './api.js';
import { Brand,Button,IconButton,Loader,Message,Modal,Receipt,Empty } from './ui.jsx';
import { OperationModal } from './operations.jsx';
import { Overview,Statement,Pix,Cards,Goals,Payments,Loans,Profile,Help } from './views.jsx';
import { formatDate } from './money.js';
import { Preferences } from '@capacitor/preferences';
const NAV=[['inicio','Início',Home],['pix','Área Pix',Layers],['extrato','Extrato',ArrowUpDown],['cartoes','Meus cartões',CreditCard],['caixinhas','Caixinhas',Target],['pagamentos','Pagamentos',FileText],['emprestimos','Empréstimos',Landmark]];
const EXTRA=[['perfil','Meu perfil',UserRound],['ajuda','Central de ajuda',HelpCircle]];
const VIEWS=new Set([...NAV,...EXTRA].map(n=>n[0]));
function readView(){const v=location.hash.replace(/^#\/?/,'').split('?')[0];return VIEWS.has(v)?v:'inicio';}
export default function Workspace(){
 const auth=useAuth(),userId=auth.session.user.id;
 const[view,setView]=useState(readView),[data,setData]=useState(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false),[version,setVersion]=useState(0),[drawer,setDrawer]=useState(false),[operation,setOperation]=useState(null),[receipt,setReceipt]=useState(null),[notifications,setNotifications]=useState(false),[toast,setToast]=useState(null),[hidden,setHidden]=useState(false);
 const alive=useRef(true),sequence=useRef(0);
 function notify(message,type='success'){setToast({message,type,id:Date.now()});}
 const refresh=useCallback(async()=>{
  const seq=++sequence.current;setRefreshing(true);
  try{await initializeAccount();const next=await loadDashboard(userId);if(alive.current&&seq===sequence.current){setData(next);setError('');setVersion(v=>v+1);}}
  catch(e){if(alive.current&&seq===sequence.current)setError(friendlyError(e));}
  finally{if(alive.current&&seq===sequence.current)setRefreshing(false);}
 },[userId]);
 useEffect(()=>{alive.current=true;refresh();const tick=()=>{if(document.visibilityState!=='hidden')refresh();};const timer=setInterval(tick,20000);window.addEventListener('focus',tick);window.addEventListener('online',tick);return()=>{alive.current=false;clearInterval(timer);window.removeEventListener('focus',tick);window.removeEventListener('online',tick);};},[refresh]);
 useEffect(()=>{const fn=()=>{setView(readView());setDrawer(false);};window.addEventListener('hashchange',fn);return()=>window.removeEventListener('hashchange',fn);},[]);
 useEffect(()=>{document.documentElement.dataset.theme=data?.profile.theme||'light';return()=>{delete document.documentElement.dataset.theme;};},[data?.profile.theme]);
 useEffect(()=>{let live=true;Preferences.get({key:'nu_hide_balance_'+userId}).then(({value})=>{if(live)setHidden(value==='true');}).catch(()=>{});return()=>{live=false;};},[userId]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(null),5500);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{if(!drawer)return;const fn=e=>{if(e.key==='Escape')setDrawer(false);};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn);},[drawer]);
 function navigate(next){location.hash='/'+next;setView(next);setDrawer(false);window.scrollTo({top:0,behavior:'auto'});}
 function open(type,item=null){setOperation({type,item});}
 async function toggleBalance(){const next=!hidden;setHidden(next);try{await Preferences.set({key:'nu_hide_balance_'+userId,value:String(next)});}catch{notify('Preferência visual não salva neste dispositivo.','error');}}
 async function logout(){try{await auth.actions.signOut();}catch(e){notify(friendlyError(e),'error');}}
 const activeLabel=[...NAV,...EXTRA].find(n=>n[0]===view)?.[1]||'Início';
 const props={data,open,navigate,onReceipt:setReceipt,hidden,notify,userId,version};
 let content=null;
 if(!data)content=<section className="panel initial-panel">{error?<><h1>Vamos conectar sua conta.</h1><Message>{error}</Message><p className="subtle">Confira o arquivo COMECE-AQUI.md e execute o SQL completo no seu projeto Supabase.</p><Button icon={RefreshCw} busy={refreshing} onClick={refresh}>Tentar novamente</Button></>:<Loader label="Preparando sua conta acadêmica…"/>}</section>;
 else if(view==='inicio')content=<Overview {...props} onToggleBalance={toggleBalance}/>;
 else if(view==='extrato')content=<Statement {...props}/>;
 else if(view==='pix')content=<Pix {...props}/>;
 else if(view==='cartoes')content=<Cards {...props}/>;
 else if(view==='caixinhas')content=<Goals {...props}/>;
 else if(view==='pagamentos')content=<Payments {...props}/>;
 else if(view==='emprestimos')content=<Loans {...props}/>;
 else if(view==='perfil')content=<Profile {...props}/>;
 else content=<Help {...props}/>;
 return <div className="app-shell"><div className="demo-strip">PROJETO ACADÊMICO INDEPENDENTE <span>·</span> Valores fictícios · Sem vínculo com o Nubank</div>{drawer&&<button className="drawer-shade" aria-label="Fechar menu" onClick={()=>setDrawer(false)}/>}<aside className={'sidebar '+(drawer?'open':'')}><div className="sidebar-head"><Brand/><button className="icon-button drawer-close" aria-label="Fechar menu" onClick={()=>setDrawer(false)}><X size={19}/></button></div><div className="account-switch"><span className="avatar">{(data?.profile.display_name||auth.session.user.email||'U').slice(0,1).toUpperCase()}</span><div><strong>{data?.profile.display_name||'Minha conta'}</strong><span>Conta pessoal · acadêmica</span></div><ChevronRight size={15}/></div><span className="nav-caption">MINHA VIDA FINANCEIRA</span><nav aria-label="Menu principal">{NAV.map(([id,label,Icon])=><button key={id} onClick={()=>navigate(id)} className={view===id?'active':''} aria-current={view===id?'page':undefined}><Icon size={20}/>{label}{view===id&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-footer"><nav aria-label="Sua conta">{EXTRA.map(([id,label,Icon])=><button key={id} onClick={()=>navigate(id)} className={view===id?'active':''}><Icon size={20}/>{label}</button>)}<button onClick={logout}><LogOut size={20}/>Sair da conta</button></nav><div className="sidebar-safe"><ShieldCheck size={17}/><span>Sessão protegida<br/><small>React + Supabase + Capacitor</small></span></div></div></aside>
 <div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Abrir menu" onClick={()=>setDrawer(true)}><Menu size={22}/></button><span>Minha conta</span><ChevronRight size={14}/><strong>{activeLabel}</strong></div><div className="topbar-actions"><span className="today">{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long'}).format(new Date())}</span><IconButton icon={RefreshCw} label="Atualizar conta" disabled={refreshing} onClick={refresh}/><button className="icon-button notification-button" aria-label="Notificações" disabled={!data} onClick={()=>setNotifications(true)}><Bell size={21}/>{Number(data?.monthly?.unread)>0&&<span>{Math.min(99,Number(data.monthly.unread))}</span>}</button><button className="avatar avatar-button" aria-label="Abrir meu perfil" onClick={()=>navigate('perfil')}>{(data?.profile.display_name||'U').slice(0,1).toUpperCase()}</button></div></header><main className="main-content" id="main-content">{data&&error&&<Message>{error} Os dados exibidos podem estar desatualizados.</Message>}{content}<footer className="page-footer"><span>Nubank · Projeto acadêmico</span><span>Feito por Gustavo · PPDM2</span></footer></main></div>
 <nav className="bottom-nav" aria-label="Atalhos no celular">{[['inicio','Início',Home],['pix','Pix',Layers],['cartoes','Cartões',CreditCard],['caixinhas','Caixinhas',Target]].map(([id,label,Icon])=><button key={id} className={view===id?'active':''} onClick={()=>navigate(id)}><Icon size={21}/><span>{label}</span></button>)}<button onClick={()=>setDrawer(true)}><Menu size={21}/><span>Mais</span></button></nav>
 {toast&&<div className={'toast '+toast.type} role={toast.type==='error'?'alert':'status'}>{toast.type==='success'&&<CheckCircle2 size={19}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="Fechar aviso"><X size={16}/></button></div>}
 {operation&&data&&<OperationModal key={operation.type+'-'+(operation.item?.id||'new')} operation={operation.type} item={operation.item} data={data} onClose={()=>setOperation(null)} onDone={()=>{setOperation(null);notify('Alteração registrada no seu banco acadêmico.');refresh();}}/>}
 {receipt&&<Receipt row={receipt} onClose={()=>setReceipt(null)}/>}
 {notifications&&data&&<Modal title="Suas notificações" subtitle="As 30 mensagens mais recentes." onClose={()=>setNotifications(false)}>{data.notifications.length?<div className="notification-list">{data.notifications.map(n=><article className={!n.read_at?'unread':''} key={n.id}><span className="mini-icon lavender"><Bell size={18}/></span><div><strong>{n.title}</strong><p>{n.body}</p><small>{formatDate(n.created_at,true)}</small></div></article>)}</div>:<Empty title="Tudo em dia">Novidades da sua conta vão aparecer aqui.</Empty>}<Button className="secondary wide" disabled={!Number(data.monthly.unread)} onClick={()=>{setNotifications(false);open('notifications_read');}}>Marcar todas como lidas</Button></Modal>}
 </div>;
}
