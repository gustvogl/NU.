import { useEffect,useRef } from 'react';
import { X,ArrowDownLeft,ArrowUpRight,CreditCard,CheckCircle2,LoaderCircle,Inbox } from 'lucide-react';
import { brl,formatDate } from './money.js';
export function Brand(){return <div className="brand"><span className="nu-word">nu</span><span>Nubank<small>projeto acadêmico</small></span></div>;}
export function Message({children,type='error'}){return children?<div className={'message '+type} role={type==='error'?'alert':'status'}>{children}</div>:null;}
export function Loader({label='Carregando sua conta…'}){return <div className="loader-box" role="status"><LoaderCircle className="spin"/><span>{label}</span></div>;}
export function Empty({title='Nada por aqui ainda',children,action}){return <div className="empty"><span className="empty-icon"><Inbox size={25}/></span><h3>{title}</h3><p>{children}</p>{action}</div>;}
export function Button({children,icon:Icon,className='',busy=false,...props}){return <button className={'button '+className} {...props} disabled={props.disabled||busy}>{busy?<LoaderCircle size={17} className="spin"/>:Icon?<Icon size={18}/>:null}{children}</button>;}
export function IconButton({icon:Icon,label,...props}){return <button className="icon-button" title={label} aria-label={label} {...props}><Icon size={20}/></button>;}
export function SectionHead({title,subtitle,children}){return <div className="section-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{children}</div>;}
export function Modal({title,subtitle,onClose,busy=false,children}){
 const ref=useRef(null),savedFocus=useRef(null);
 useEffect(()=>{
  savedFocus.current=document.activeElement;const old=document.body.style.overflow;document.body.style.overflow='hidden';
  const first=ref.current?.querySelector('input,select,textarea,button:not([aria-label="Fechar"])');(first||ref.current)?.focus();
  return()=>{document.body.style.overflow=old;savedFocus.current?.focus?.();};
 },[]);
 function keyDown(e){
  if(e.key==='Escape'&&!busy){e.stopPropagation();onClose();}
  if(e.key==='Tab'){
   const all=Array.from(ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')).filter(el=>el.offsetParent!==null);
   if(!all.length){e.preventDefault();return;}
   if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1).focus();}
   else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0].focus();}
  }
 }
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} onKeyDown={keyDown}><div className="modal-head"><div><span className="eyebrow">AMBIENTE ACADÊMICO</span><h2 id="modal-title">{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><IconButton icon={X} label="Fechar" disabled={busy} onClick={onClose}/></div>{children}</section></div>;
}
const labels={welcome:'Saldo inicial',deposit:'Saldo fictício',pix_out:'Pix enviado',pix_in:'Pix recebido',payment:'Pagamento',topup:'Recarga',goal_deposit:'Caixinha',goal_withdraw:'Resgate',card_purchase:'Crédito',invoice_pay:'Fatura',loan_credit:'Empréstimo',loan_pay:'Parcela'};
export function TransactionList({rows,onReceipt,hidden=false}){
 return <div className="transactions">{rows.map(row=>{
  const incoming=Number(row.delta_cents)>0,credit=Number(row.delta_cents)===0,Icon=credit?CreditCard:incoming?ArrowDownLeft:ArrowUpRight;
  return <button className="transaction" key={row.id} onClick={()=>onReceipt(row)} aria-label={'Ver comprovante: '+row.description}>
   <span className={'transaction-icon '+(incoming?'income':credit?'credit':'')}><Icon size={20}/></span>
   <span className="transaction-description"><strong>{row.counterparty||row.description}</strong><small>{labels[row.kind]||row.description} · {formatDate(row.created_at)}</small></span>
   <span className={'transaction-amount '+(incoming?'positive':'')}>{hidden?'••••':(credit?'':incoming?'+':'−')+brl(row.amount_cents)}<small>{credit?'no crédito':'concluído'}</small></span>
  </button>;
 })}</div>;
}
export function downloadText(name,body,mime='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([body],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function Receipt({row,onClose}){
 const body=['NUBANK — PROJETO ACADÊMICO','COMPROVANTE DE OPERAÇÃO FICTÍCIA','Sem validade bancária. Não representa transferência ou pagamento real.','',row.description,'Valor: '+brl(row.amount_cents),'Contraparte: '+(row.counterparty||'Projeto'),'Data: '+formatDate(row.created_at,true),'Operação: '+row.operation_id,'Registro: '+row.id].join('\n');
 return <Modal title="Comprovante acadêmico" onClose={onClose}><div className="receipt"><CheckCircle2 size={42}/><h3>Operação registrada no projeto</h3><strong className="receipt-value">{brl(row.amount_cents)}</strong><dl><dt>Tipo</dt><dd>{row.description}</dd><dt>Contraparte</dt><dd>{row.counterparty||'Projeto'}</dd><dt>Data</dt><dd>{formatDate(row.created_at,true)}</dd><dt>Identificador</dt><dd className="mono">{row.operation_id}</dd></dl><p className="subtle">Valores fictícios. Este documento não comprova movimentação bancária real.</p></div><div className="form-actions"><Button onClick={()=>downloadText('comprovante-academico-'+row.id+'.txt',body)}>Baixar comprovante</Button><Button className="secondary" onClick={()=>window.print()}>Imprimir / PDF</Button></div></Modal>;
}
