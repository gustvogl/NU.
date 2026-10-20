import {cp,rm,writeFile} from 'node:fs/promises';
const folder='PRONTO-PARA-PUBLICAR';
await rm(folder,{recursive:true,force:true});
await cp('dist',folder,{recursive:true});
const headers=[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]},{source:'/config.json',headers:[{key:'Cache-Control',value:'no-store, max-age=0'}]}];
await writeFile(folder+'/vercel.json',JSON.stringify({$schema:'https://openapi.vercel.sh/vercel.json',framework:null,buildCommand:'',installCommand:'',outputDirectory:'.',rewrites:[{source:'/(.*)',destination:'/index.html'}],headers},null,2));
console.log('Versão pronta em PRONTO-PARA-PUBLICAR. Não precisa instalar dependências para publicar essa pasta.');
