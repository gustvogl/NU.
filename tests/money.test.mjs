import test from 'node:test';import assert from 'node:assert/strict';
import { parseMoney,brl,loanQuote,escapeCsv } from '../src/money.js';
import { readConfig } from '../src/config.js';
test('centavos não sofrem arredondamento de ponto flutuante',()=>{
 assert.equal(parseMoney('0,29'),29);assert.equal(parseMoney('150.5'),15050);
 for(const bad of ['0','-1','1e3','1.000,00','1.001','Infinity',''])assert.throws(()=>parseMoney(bad));
 assert.match(brl(15050),/150,50/);
});
test('simulação apresenta total e juros coerentes',()=>{const q=loanQuote(100000,12);assert.equal(q.total,q.payment*12);assert.equal(q.interest,q.total-100000);});
test('CSV escapa aspas e neutraliza fórmulas',()=>{assert.equal(escapeCsv('=1+1'),'"\'=1+1"');assert.equal(escapeCsv('a"b'),'"a""b"');});
test('configuração recusa chaves secretas mesmo sem URL',()=>{
 assert.equal(readConfig({VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_123'}).unsafe,true);
 assert.equal(readConfig({VITE_SUPABASE_URL:'https://x.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_123'}).ready,true);
 assert.equal(readConfig({VITE_SUPABASE_URL:'http://dominio.com',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_123'}).ready,false);
});
