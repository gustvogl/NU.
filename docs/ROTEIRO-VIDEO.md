# Roteiro curto — PPDM2: sessões seguras no híbrido

Execute o SQL no seu Supabase e sincronize o Android. A URL e a chave pública podem ser informadas pela tela na primeira abertura:

```bash
npm ci
npm run android:sync
npm run android:open
```

Grave a tela do celular ou emulador:

1. Abra **Banco Acadêmico** e mostre o login.
2. Cadastre/entre com uma conta exclusiva do seu Supabase.
3. Mostre a tela interna com saldo e extrato carregados.
4. Em **Meu perfil**, mostre Sessão persistente e os dois contadores.
5. Incremente os contadores volátil e persistente.
6. Abra Configurações do Android → Apps → Banco Acadêmico → Forçar parada.
7. Volte à tela inicial do celular e toque no ícone do app.
8. Mostre o loading breve e o acesso direto à área interna, sem digitar senha.
9. Volte ao perfil: o contador volátil deve zerar; o persistente deve permanecer.
10. Use Sair da conta, encerre e reabra para conferir que o logout também persiste.

Fala sugerida:

“O estado do React fica na memória e é perdido ao encerrar o processo. Os tokens da sessão ficam no Capacitor Preferences. Ao abrir novamente, o AuthContext lê os tokens e restaura a sessão no Supabase antes de liberar as telas internas. A senha não fica salva.”

Opcional: entre com uma segunda conta no navegador e demonstre um Pix fictício atualizando saldo e extrato das duas contas.

Para entregar no Classroom, envie o link do GitHub ou o ZIP do código e o vídeo real do dispositivo. O código não substitui a gravação exigida.
