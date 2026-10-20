# Banco acadêmico — conectar e usar

Esta versão conecta ao seu Supabase pela própria tela. **Não precisa editar .env para usar ou publicar a versão pronta.**

## Para começar: 3 passos

1. Abra seu projeto em [Supabase](https://supabase.com/dashboard), entre em **SQL Editor**, cole TODO o conteúdo de **supabase/01-banco.sql** e clique em **Run**.
2. Abra o site e cole a **Project URL** e a chave **publishable** (ou a antiga **anon**) nos campos da tela **Conecte seu banco**.
3. Clique em **Testar e conectar → Entrar no banco**. Crie uma conta exclusiva do projeto e entre.

A tela também permite **baixar/copiar o SQL**. Ela confere se a instalação está completa antes de salvar a conexão. Não use chave secret ou service_role.

Se você já instalou a versão anterior, execute o novo SQL completo no mesmo projeto. Ele atualiza as funções e permissões sem apagar contas, saldos ou extratos. As sessões antigas sem identificação do projeto exigem novo login uma vez.

O site usa Supabase Auth. Mantenha o provedor de e-mail ativo em Authentication. Se **Confirm email** estiver ativo, confirme o e-mail antes de entrar. Para uma apresentação em ambiente de teste, você pode desativar essa confirmação no painel. Não é necessário criar usuários manualmente nas tabelas.

## Publicar na Vercel sem instalar nada

O ZIP tem a pasta **PRONTO-PARA-PUBLICAR** com o site compilado, SQL e configuração.

1. Extraia o ZIP inteiro e envie os arquivos ao seu repositório GitHub. Não envie apenas o ZIP.
2. Na [Vercel](https://vercel.com/new), importe o repositório.
3. Em **Root Directory**, selecione **PRONTO-PARA-PUBLICAR**.
4. Use **Framework Preset: Other**. Não adicione comando de instalação nem de build. Output Directory: **.**
5. Publique. O vercel.json dessa pasta já declara essa configuração.
6. Abra o site, faça os 3 passos de conexão e comece a usar.

**A conexão salva pela tela vale para aquele navegador/dispositivo.** Para deixar o site pronto para TODOS os visitantes:

1. Na tela de conexão, depois de testar, clique em **Baixar config.json para publicar**.
2. Substitua **PRONTO-PARA-PUBLICAR/config.json** pelo arquivo baixado no seu GitHub.
3. Aguarde o novo deploy. Novos visitantes já entram na tela de login, ligados ao mesmo Supabase.

O arquivo usa somente a URL e a chave pública. Não contém senhas, tokens de sessão ou chave secreta. Você também pode preencher o config.json manualmente:

```json
{
  "version": 1,
  "supabaseUrl": "https://SEU-PROJETO.supabase.co",
  "supabasePublishableKey": "sb_publishable_SUA_CHAVE_PUBLICA"
}
```

No Supabase, ajuste **Authentication → URL Configuration**:
- **Site URL**: a URL de produção da sua Vercel.
- **Redirect URLs**: essa mesma URL e suas URLs locais/de preview, se usar.

Isso permite confirmação e recuperação de senha no endereço correto.

## Desenvolver ou alterar o código

Instale Node.js **22.x**, extraia o projeto e rode:

```bash
npm ci
npm run dev
```

Você pode continuar configurando pela tela. Para publicar alterações feitas no código:

```bash
npm run build
```

O comando atualiza automaticamente a pasta **PRONTO-PARA-PUBLICAR**. Para incluir configuração em novos builds, coloque o config.json em **public/config.json** antes de compilar.

O .env e as variáveis da Vercel continuam aceitos como alternativa para quem publica o código-fonte. Não são obrigatórios. A conexão escolhida neste dispositivo tem prioridade; use **Configurar conexão com Supabase → Usar configuração publicada** para removê-la.

O arquivo **INICIAR-WINDOWS.cmd** instala as dependências e abre o servidor. Não pede para editar .env.

## Android — atividade PPDM2

O código do Android está incluído; o ZIP não contém APK compilado.

```bash
npm ci
npm run android:sync
npm run android:open
```

Use Android Studio, JDK 21 e SDK Android 36. Na primeira abertura, configure URL e chave pública pela tela do próprio app. A configuração e os tokens ficam no Capacitor Preferences.

Se preferir instalar o APK já apontando para seu projeto, coloque o config.json em public/config.json antes de executar android:sync.

Faça o roteiro em **docs/ROTEIRO-VIDEO.md**: login → forçar parada → reabrir → auto-login. O contador volátil zera e o persistente permanece.

## O que está incluído

- Login, cadastro e recuperação de senha.
- Sessão persistente, splash e renovação de tokens.
- Conta individual com saldo inicial fictício de R$ 1.000, uma única vez.
- Pix interno entre usuários, chaves e agendamentos.
- Extrato com filtros, CSV e comprovante acadêmico.
- Cartões fictícios, bloqueio, limite, compras e pagamento da fatura.
- Pagamentos e recargas simulados.
- Caixinhas com metas, depósitos e resgates.
- Empréstimo didático com cálculo de parcelas.
- Perfil, tema claro/escuro, notificações e solicitações de teste.
- RLS e operações financeiras validadas pelo servidor.

O dinheiro é fictício. O projeto não é operado pelo Nubank e não conecta a bancos, Pix oficial, boletos, cartões ou operadoras reais.

## Testar e conferir

```bash
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Os testes usam PostgreSQL embarcado e uma API de teste. Eles não alteram seu Supabase.

Depois de configurar o projeto real, crie duas contas diferentes e transfira entre elas. Rode **supabase/02-verificar.sql**: as consultas de inconsistência devem retornar zero linhas. Teste também o Android no celular para validar o fechamento forçado.

## Resolver problemas

| Mensagem | Solução |
| --- | --- |
| Falta instalar ou atualizar o banco | Execute TODO o novo 01-banco.sql no mesmo Supabase e tente novamente. |
| Chave não aceita | Copie publishable ou anon do mesmo projeto da URL. |
| Chave secreta | Não use secret ou service_role. |
| Supabase não responde | Confira URL, internet e se o projeto está ativo. |
| E-mail não confirmado | Confirme no e-mail ou ajuste Confirm email no projeto de teste. |
| Não chega e-mail | Confira limites de envio, spam, SMTP e URL Configuration. |
| Chave Pix não encontrada | O destinatário precisa ter conta/chave neste mesmo projeto. |
| Visitante ainda vê configuração | Publique o config.json preenchido em PRONTO-PARA-PUBLICAR. |
| Quero trocar o Supabase | Abra ?configurar=1 ou o link de configuração na tela de login. |
| O aparelho usa configuração antiga | Clique em Usar configuração publicada no instalador. |
| Android está desatualizado | Rode npm run android:sync depois das mudanças. |

Não publique .env, node_modules, chaves de assinatura nem android/local.properties. O config.json com SOMENTE chave pública pode ser publicado.
