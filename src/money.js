export const brl = (cents) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(cents || 0) / 100);
export function parseMoney(value) {
 const text = String(value ?? '').trim();
 if (!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Digite um valor como 150,00, sem ponto de milhar.');
 const [whole, fraction = ''] = text.replace(',', '.').split('.');
 const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 10000000) throw new Error('O valor deve ficar entre R$ 0,01 e R$ 100.000,00.');
 return cents;
}
export function loanQuote(cents, months) {
 const rate = .02;
 const payment = Math.round(cents * rate / (1 - Math.pow(1 + rate, -months)));
 return { payment, total: payment * months, interest: payment * months - cents };
}
export function escapeCsv(value) {
 return '"' + String(value ?? '').replace(/"/g, '""').replace(/^[=+@-]/, "'$&") + '"';
}
export function formatDate(value, full = false) {
 return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', ...(full ? {timeStyle:'short'} : {}) }).format(new Date(value));
}
export function monthStart() { const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return d.toISOString(); }
