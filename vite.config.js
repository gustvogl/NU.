import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { readConfig } from './src/config.js';
export default defineConfig(({ mode }) => {
 const config = readConfig(loadEnv(mode, process.cwd(), 'VITE_'));
 const file=JSON.parse(readFileSync('public/config.json','utf8'));
 const fileConfig=readConfig({VITE_SUPABASE_URL:file.supabaseUrl,VITE_SUPABASE_PUBLISHABLE_KEY:file.supabasePublishableKey});
 if (config.unsafe||fileConfig.unsafe) throw new Error('Use somente a chave pública publishable/anon do Supabase. Nunca use secret/service_role.');
 return { base:'./', plugins: [react()], build: { target: 'es2022' } };
});