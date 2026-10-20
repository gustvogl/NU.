import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('public',{recursive:true});
const sql=await readFile('supabase/01-banco.sql','utf8');
await writeFile('public/setup.sql',sql);
console.log('SQL de instalação atualizado.');
