import { useRef,useState } from 'react';
import { ArrowRight,CheckCircle2,Search,ShieldCheck } from 'lucide-react';
import { Modal,Button,Message } from './ui.jsx';
import { operate,lookupRecipient,friendlyError } from './api.js';
import { brl,parseMoney,loanQuote,formatDate } from './money.js';
const titles={deposit:'Adicionar saldo fictício',transfer:'Enviar Pix acadêmico',payment:'Pagar boleto de teste',topup:'Recarga de teste',key_create:'Cadastrar chave Pix',key_remove:'Remover chave',goal_create:'Criar caixinha',goal_deposit:'Guardar dinheiro',goal_withdraw:'Resgatar da caixinha',goal_remove:'Excluir caixinha',card_create:'Criar cartão virtual',card_block:'Alterar bloqueio do cartão',card_limit:'Ajustar limite fictício',card_purchase:'Simular compra no crédito',invoice_pay:'Pagar fatura simulada',loan_create:'Simular empréstimo',loan_pay:'Pagar parcela fictícia',schedule_create:'Agendar Pix acadêmico',schedule_cancel:'Cancelar agendamento',profile_update:'Seu perfil',notifications_read:'Marcar notificações como lidas',ticket_create:'Nova solicitação do projeto',ticket_close:'Encerrar solicitação'};
const moneyTypes=['deposit','transfer','payment','topup','goal_create','goal_deposit','goal_withdraw','card_limit','card_purchase','loan_create','schedule_create'];
const reviewTypes=[...moneyTypes,'invoice_pay','loan_pay'];
export function OperationModal({operation,item,data,onClose,onDone}){
 const [fields,setFields]=useState({amount:operation==='card_limit'?String(data.account.credit_limit_cents/100):'',key:'',description:'',merchant:'',barcode:'',phone:'',operator:'Vivo',kind:'random',label:'',months:'12',due_at:'',name:data.profile.display_name,profilePhone:data.profile.phone,theme:data.profile.theme,subject:'',message:''});
 const [busy,setBusy]=useState(false),[searching,setSearching]=useState(false),[error,setError]=useState(''),[recipient,setRecipient]=useState(null),[review,setReview]=useState(null);
 const request=useRef(null);
 const set=(key,value)=>setFields(prev=>({...prev,[key]:value}));
 const fixedAmount=operation==='invoice_pay'?data.account.credit_used_cents:operation==='loan_pay'?Math.min(item.installment_cents,item.remaining_cents):null;
 let quote=null;try{if(operation==='loan_create')quote=loanQuote(parseMoney(fields.amount),Number(fields.months));}catch{}
 function payload(){
  const p={};
  if(moneyTypes.includes(operation))p.amount=parseMoney(fields.amount);
  if(['transfer','schedule_create'].includes(operation)){
   if(!recipient||recipient.key!==fields.key.trim().toLowerCase())throw Error('Busque e confira o destinatário antes de continuar.');
   p.key=recipient.key;p.description=fields.description.trim();
  }
  if(operation==='schedule_create'){
   const d=new Date(fields.due_at);if(!fields.due_at||!Number.isFinite(d.getTime())||d<=new Date())throw Error('Escolha uma data e horário futuros.');
   p.due_at=d.toISOString();
  }
  if(operation==='payment'){p.merchant=fields.merchant.trim();p.barcode=fields.barcode.replace(/\D/g,'');}
  if(operation==='topup'){p.phone=fields.phone;p.operator=fields.operator;}
  if(operation==='key_create')p.kind=fields.kind;
  if(['goal_create','card_create'].includes(operation))p.label=fields.label.trim();
  if(operation==='loan_create')p.months=Number(fields.months);
  if(operation==='card_purchase')p.merchant=fields.merchant.trim();
  if(item?.id)p.id=item.id;
  if(operation==='profile_update')Object.assign(p,{name:fields.name.trim(),phone:fields.profilePhone.trim(),theme:fields.theme});
  if(operation==='ticket_create')Object.assign(p,{subject:fields.subject.trim(),message:fields.message.trim()});
  return p;
 }
 async function searchRecipient(){
  setSearching(true);setError('');setRecipient(null);
  try{const result=await lookupRecipient(fields.key);if(result.own)throw Error('Informe a chave de outra conta cadastrada no projeto.');setRecipient(result);}
  catch(e){setError(friendlyError(e));}finally{setSearching(false);}
 }
 async function submit(e){
  e.preventDefault();setError('');
  try{
   const p=review?.payload||payload();
   if(!review&&reviewTypes.includes(operation)){setReview({payload:p,amount:fixedAmount??p.amount});return;}
   const fingerprint=JSON.stringify([operation,p]);
   if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()};
   setBusy(true);const result=await operate(operation,p,request.current.id);
   onDone(result);
  }catch(e){setError(friendlyError(e));setBusy(false);}
 }
 const summary=operation==='transfer'?'O valor será debitado da sua conta e creditado na conta do destinatário deste projeto.':operation==='schedule_create'?'O agendamento será processado na próxima abertura ou atualização do app após a data escolhida.':'A operação altera somente os dados e valores fictícios deste projeto.';
 return <Modal title={titles[operation]||'Operação'} subtitle={item?.label||undefined} onClose={onClose} busy={busy}>
 <Message>{error}</Message>
 <form onSubmit={submit}>
 {review?<div className="review"><span className="review-icon"><ShieldCheck size={25}/></span><span className="eyebrow">CONFIRA ANTES DE CONFIRMAR</span><strong className="review-value">{brl(review.amount)}</strong><dl>{recipient&&<><dt>Destinatário</dt><dd>{recipient.name}</dd><dt>Conta acadêmica</dt><dd>{recipient.account}</dd></>}{item?.label&&<><dt>Destino</dt><dd>{item.label}</dd></>}{fields.merchant&&<><dt>Beneficiário / loja</dt><dd>{fields.merchant}</dd></>}{operation==='loan_create'&&quote&&<><dt>Parcelas</dt><dd>{fields.months} × {brl(quote.payment)}</dd><dt>Total fictício</dt><dd>{brl(quote.total)}</dd><dt>Juros da simulação</dt><dd>2% a.m. · {brl(quote.interest)}</dd></>}{operation==='schedule_create'&&<><dt>Data</dt><dd>{formatDate(review.payload.due_at,true)}</dd></>}</dl><p className="subtle">{summary}</p></div>:<>
 {['transfer','schedule_create'].includes(operation)&&<><label>Chave do destinatário no projeto<div className="input-action"><input value={fields.key} onChange={e=>{set('key',e.target.value);setRecipient(null);}} placeholder="E-mail ou chave aleatória" required maxLength={200} disabled={busy}/><Button type="button" icon={Search} className="secondary" busy={searching} disabled={!fields.key.trim()||busy} onClick={searchRecipient}>Buscar</Button></div></label>{recipient&&<div className="recipient"><CheckCircle2 size={22}/><div><strong>{recipient.name}</strong><small>{recipient.account} · Conta deste projeto</small></div></div>}</>}
 {operation==='payment'&&<><label>Beneficiário fictício<input value={fields.merchant} onChange={e=>set('merchant',e.target.value)} placeholder="Ex.: Escola de teste" minLength={2} maxLength={80} required/></label><label>Código de barras de teste<textarea value={fields.barcode} onChange={e=>set('barcode',e.target.value)} placeholder="44, 47 ou 48 dígitos" required maxLength={70}/></label><button type="button" className="text-button" onClick={()=>set('barcode','1'.repeat(44))}>Preencher código fictício para testar</button></>}
 {operation==='topup'&&<><label>Celular para demonstração<input value={fields.phone} onChange={e=>set('phone',e.target.value)} inputMode="tel" placeholder="(15) 99999-9999" minLength={10} maxLength={20} required/></label><label>Operadora<select value={fields.operator} onChange={e=>set('operator',e.target.value)}>{['Vivo','Claro','TIM','Outra'].map(x=><option key={x}>{x}</option>)}</select></label></>}
 {['goal_create','card_create'].includes(operation)&&<label>{operation==='goal_create'?'Nome da caixinha':'Nome do cartão'}<input value={fields.label} onChange={e=>set('label',e.target.value)} placeholder={operation==='goal_create'?'Ex.: Minha primeira casa':'Ex.: Compras online'} minLength={2} maxLength={operation==='goal_create'?60:40} required/></label>}
 {operation==='card_purchase'&&<label>Loja fictícia<input value={fields.merchant} onChange={e=>set('merchant',e.target.value)} minLength={2} maxLength={80} placeholder="Ex.: Loja de demonstração" required/></label>}
 {moneyTypes.includes(operation)&&(operation==='topup'?<label>Valor da recarga<select value={fields.amount} onChange={e=>set('amount',e.target.value)} required><option value="">Selecione</option>{[10,20,30,50,100].map(n=><option key={n} value={n}>{brl(n*100)}</option>)}</select></label>:<label>{operation==='goal_create'?'Quanto você quer juntar?':'Valor em reais'}<div className="money-input"><span>R$</span><input value={fields.amount} onChange={e=>set('amount',e.target.value)} inputMode="decimal" placeholder="0,00" maxLength={12} required autoComplete="off"/></div></label>)}
 {['transfer','schedule_create'].includes(operation)&&<label>Mensagem (opcional)<input value={fields.description} onChange={e=>set('description',e.target.value)} maxLength={120} placeholder="Para que é essa transferência?"/></label>}
 {operation==='schedule_create'&&<label>Data e horário de execução<input type="datetime-local" value={fields.due_at} onChange={e=>set('due_at',e.target.value)} required/><small className="subtle">Executado quando você abrir ou atualizar o app após essa data.</small></label>}
 {operation==='key_create'&&<label>Tipo de chave<select value={fields.kind} onChange={e=>set('kind',e.target.value)}><option value="random">Chave aleatória criada pelo servidor</option><option value="email">Meu e-mail cadastrado</option></select><small className="subtle">Funciona apenas entre contas deste mesmo projeto.</small></label>}
 {operation==='loan_create'&&<><label>Número de parcelas<select value={fields.months} onChange={e=>set('months',e.target.value)}>{[2,3,6,12,18,24].map(n=><option key={n} value={n}>{n} parcelas</option>)}</select></label>{quote&&<div className="loan-quote"><strong>{fields.months} × {brl(quote.payment)}</strong><span>Total: {brl(quote.total)} · Juros: {brl(quote.interest)}</span></div>}<p className="subtle">Simulação didática com taxa fixa de 2% ao mês, sem contratação de crédito real. O servidor confere os valores.</p></>}
 {operation==='profile_update'&&<><label>Nome<input value={fields.name} onChange={e=>set('name',e.target.value)} minLength={2} maxLength={80} required/></label><label>Telefone (opcional)<input value={fields.profilePhone} onChange={e=>set('profilePhone',e.target.value)} maxLength={20} autoComplete="tel"/></label><label>Aparência<select value={fields.theme} onChange={e=>set('theme',e.target.value)}><option value="light">Clara</option><option value="dark">Escura</option></select></label></>}
 {operation==='ticket_create'&&<><label>Assunto<input value={fields.subject} onChange={e=>set('subject',e.target.value)} minLength={3} maxLength={100} required/></label><label>Mensagem<textarea value={fields.message} onChange={e=>set('message',e.target.value)} minLength={5} maxLength={2000} required rows={5}/></label><p className="subtle">A solicitação é salva para demonstração. Ela não é enviada ao atendimento oficial do Nubank.</p></>}
 {fixedAmount!==null&&<div className="fixed-amount"><span>Valor a debitar do saldo fictício</span><strong>{brl(fixedAmount)}</strong></div>}
 {operation==='card_block'&&<p>Seu cartão ficará {item.blocked?'desbloqueado para novas compras simuladas.':'bloqueado para novas compras simuladas.'}</p>}
 {['key_remove','goal_remove','schedule_cancel','ticket_close','notifications_read'].includes(operation)&&<p className="subtle">Confirme para registrar esta alteração na sua conta do projeto.</p>}
 {operation==='deposit'&&<p className="subtle">Este botão adiciona apenas saldo de teste. Não solicita depósito, cartão ou pagamento real.</p>}
 </>}
 <div className="form-actions">{review&&<Button type="button" className="secondary" disabled={busy} onClick={()=>setReview(null)}>Voltar</Button>}<Button type="submit" busy={busy} icon={ArrowRight} disabled={searching}>{review?'Confirmar operação fictícia':reviewTypes.includes(operation)?'Revisar operação':'Confirmar alteração'}</Button></div>
 </form></Modal>;
}
