# Segurança e limites da demonstração

## Isolamento de usuários

Todas as tabelas públicas nu_ têm RLS e política de leitura que compara user_id com auth.uid(). As contas e o extrato não aceitam INSERT, UPDATE ou DELETE diretamente por usuários autenticados.

As operações chegam à API por funções públicas SECURITY INVOKER. O trabalho privilegiado fica em nu_private, fora dos schemas expostos. Essas funções verificam auth.uid(), propriedade, valores, saldo e limites. Os privilégios padrão de execução de PUBLIC e anon foram revogados.

A chave usada pelo navegador é publishable ou anon. Nenhuma chave secret/service_role faz parte do projeto. O build recusa chaves com privilégios de servidor.

## Contabilidade da simulação

Valores são inteiros em centavos, no navegador e em colunas bigint do PostgreSQL.

Uma transferência faz débito, crédito e os dois registros do extrato em uma transação. As contas são bloqueadas em ordem fixa. A falta de saldo aborta toda a operação.

As operações usam um UUID de idempotência por tentativa lógica. Repetir a mesma solicitação retorna o resultado gravado; o servidor rejeita reutilizar o UUID com outro conteúdo. O formulário mantém o identificador ao repetir depois de uma falha de rede.

Não há transferências a bancos externos. A adição de saldo é um recurso explícito de teste. O crédito de empréstimo e o limite do cartão são fictícios.

## Sessão no híbrido

O SDK fica com a sessão em memória: persistSession:false. O contexto escuta SIGNED_IN, TOKEN_REFRESHED e USER_UPDATED e encadeia as gravações em Preferences. SIGNED_OUT remove a chave supabase_session.

O callback do Supabase não executa chamadas assíncronas ao próprio Auth. Ao iniciar, o contexto lê os tokens e chama auth.setSession antes de mostrar as telas internas. Isso permite renovar tokens expirados. Uma falha transitória de conexão mantém a chave para nova tentativa; uma sessão inválida é removida.

São persistidos access_token, refresh_token e expires_at. A senha não é gravada em Preferences, tabelas ou logs.

**Preferences não é armazenamento criptografado.** No Android usa SharedPreferences; no iOS usa UserDefaults; no navegador usa o fallback web. O armazenamento da atividade preserva estado, mas não equivale a um cofre bancário. Um produto financeiro de produção exigiria armazenamento protegido por Keystore/Keychain, gestão de dispositivos, defesa contra XSS e demais controles próprios.

O Android incluído desativa backup e exclui preferências de backup/transferência. No modo nativo, o app inicia/interrompe a renovação automática conforme o estado ativo do aplicativo.

## Recursos demonstrativos

- Chaves Pix são internas; não são registradas no DICT.
- Códigos de barras só validam formato de teste; não consultam boletos.
- Recargas só geram registros acadêmicos.
- Cartões não têm PAN/CVV utilizável.
- Caixinhas não rendem e não são produtos de investimento.
- Empréstimos usam taxa didática fixa de 2% a.m., sem contrato de crédito real.
- Solicitações de ajuda ficam no projeto e não chegam à instituição real.
- Agendamentos são processados ao abrir/atualizar o aplicativo, não por um cron em segundo plano.
- Não há acesso a Open Finance, SPI, adquirentes, bancos, SMS ou dados bancários reais.

## Publicação e credenciais

Não publique .env nem chaves de assinatura. No frontend, as variáveis VITE_ são públicas por definição: use somente chaves que podem ser públicas.

Configure URL Configuration no Supabase para confirmação e recuperação por e-mail. No Android, a recuperação abre a Site URL web definida no Supabase. Nenhum login pede a senha da instituição real.

O projeto é uma demonstração acadêmica independente, identificada na interface e nos comprovantes.


## Configuração direta

O config.json contém apenas URL e chave pública. As senhas e tokens de sessão não entram nesse arquivo. O instalador testa a versão e as permissões antes de salvar a conexão local. A função nu_schema_status pode ser chamada por anon e retorna somente versão, prontidão e quantidade de tabelas. Não retorna clientes, saldos ou transações.

Os tokens persistidos incluem project_url para impedir reutilizar a sessão quando o Supabase é trocado. A conexão salva no dispositivo tem prioridade sobre a configuração publicada; o instalador oferece a opção de limpar essa escolha.
