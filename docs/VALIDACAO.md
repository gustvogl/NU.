# Validação — configuração direta

A versão inicial do banco passou por testes de autenticação, contabilidade, permissões e interface. Esta atualização acrescenta:

- Configuração de URL e chave pública pela tela, salva em Preferences.
- Rejeição de chave secret/service_role.
- Verificação anônima da versão, tabelas e permissões por nu_schema_status, sem acesso a dados de clientes.
- Erro claro se o SQL ainda não foi instalado.
- Download de config.json para publicar uma configuração comum aos visitantes.
- Leitura do config.json no carregamento, sem editar .env nem recompilar.
- Separação de sessões por projeto Supabase.
- Geração automática da pasta estática PRONTO-PARA-PUBLICAR.

Testes de navegador: instalação sem .env, chave secreta recusada, SQL ausente, conexão válida, exportação e persistência da configuração, login, auto-login, Pix, caixinha, fatura, CSV, comprovante, nove telas em 390px e logout.

Um contexto de navegador novo também foi testado com config.json publicado: abriu o login sem pedir a configuração.

## Limites

Os testes executam o SQL em PostgreSQL embarcado com papéis/RLS e substituem a API de Auth para automação. Não configuram nem alteram um projeto Supabase seu.

Não houve execução de APK em emulador/celular nem teste de entrega de e-mail. Depois de configurar, valide duas contas no seu Supabase e siga o roteiro Android.
