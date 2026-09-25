# Deploy do backend (dev / prd)

Checklist para subir a API NestJS num ambiente compartilhado. O frontend (BFF
Next.js) tem o próprio guia em `../frontend/docs/deploy.md`: os dois precisam
ser configurados juntos, porque compartilham um segredo.

## 1. Variáveis de ambiente

Referência completa em `.env.example` (local), `.env.dev.example` e `.env.prd.example` (Dokploy). Em dev/prd, os valores vêm do gerenciador
de segredos da plataforma, nunca de arquivo commitado.

| Variável | Obrigatória | Observação |
|---|---|---|
| `DATABASE_URL` | sim | PostgreSQL, a fonte de verdade. |
| `REDIS_URL` | sim | Filas BullMQ: envio de e-mail, resumo diário às 08:00 e expurgo diário de contas canceladas. |
| `JWT_SECRET` | sim | Aleatório e longo, **diferente por ambiente**. Trocar invalida todas as sessões. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | sim | Padrão `15m` / `7d`. |
| `PORT` | sim | Porta HTTP da API. |
| `APP_URL` | sim | URL pública do frontend, **sem barra no final**: dev `https://dev.debandeja.store`, prd `https://debandeja.store`. Usada no CORS e nos links dos e-mails. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `MAIL_FROM` | sim | Hostinger, ver a seção 5. |
| `SMTP_USER` / `SMTP_PASS` | em dev/prd | Caixa `auth@debandeja.store` e a senha dela. Vazios no local (Mailpit). |
| `INTERNAL_API_TOKEN` | sim | Ver a seção 2. **Mesmo valor** no frontend. |
| `GOOGLE_CLIENT_ID` | sim | Mesmo Client ID OAuth Web do BFF; usado para validar o `id_token` do Google. |
| `INVITE_TOKEN_TTL_HOURS`, `EMAIL_VERIFICATION_TOKEN_TTL_HOURS`, `PASSWORD_RESET_TOKEN_TTL_HOURS` | não | Padrões 48 / 24 / 2. |

## 2. Rate limit e IP do visitante

- Requisições **autenticadas** são limitadas **por usuário** (id do JWT).
- Rotas **públicas** (login, cadastro, verificação, recuperação de senha,
  aceite de convite) são limitadas **por IP**, contra força bruta.
- O backend enxerga a conexão do BFF, não a do visitante. O IP real chega em
  `X-Client-IP` e **só é aceito junto do header `X-Internal-Token`** com o valor
  de `INTERNAL_API_TOKEN`. `X-Forwarded-For` é ignorado, porque qualquer um que
  alcance a API direto o forjaria. Implementação: `src/common/http/client-ip.ts`
  e `src/common/http/app-throttler.guard.ts`.

O que configurar:

1. Gerar `INTERNAL_API_TOKEN` (mínimo 32 caracteres) e colocar **o mesmo valor**
   no backend e no frontend. Um token por ambiente:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
   Com o token ausente, curto ou divergente, o backend ignora o IP enviado pelo
   BFF e todas as rotas públicas passam a dividir a cota do IP do BFF.
2. Não expor a API publicamente: só o BFF precisa alcançá-la (rede privada,
   firewall ou serviço interno). O token protege mesmo se ela ficar exposta, mas
   isso é uma camada a mais.
3. **Mais de uma instância da API:** o contador do throttler fica em memória, por
   instância. Com réplicas, cada uma conta separado e o limite efetivo é
   multiplicado. Antes de escalar horizontalmente, mover o storage do throttler
   para o Redis (pendente, exige nova dependência).

## 3. Imagem Docker, migrations e banco

A imagem é o `Dockerfile` deste repositório, montada pelo GitHub Actions e
publicada no GHCR (seção 7). Ela compila a API e, **a cada subida do
container**, roda nesta ordem:

```bash
prisma migrate deploy   # aplica só as migrations pendentes
prisma db seed          # garante os planos (upsert)
node dist/src/main      # sobe a API
```

Se a migration ou o seed falhar, a API não sobe e o container sai com erro: com
o health check e o rollback do Dokploy (seção 7), a versão anterior continua no
ar. O health check da imagem chama `GET /` na porta `PORT`.

- **Uma réplica só.** Com várias, todas tentariam migrar ao mesmo tempo (e o rate
  limit conta por instância, seção 2).
- Scripts operacionais rodam dentro do container (terminal do Dokploy), por
  exemplo `npm run subscription -- show --tenant <id>` (seção 4).
- **Lockfile gerado no Windows:** se o build falhar no `npm ci` com
  `Missing: @emnapi/... from lock file`, regenerar o lockfile num Linux:
  ```bash
  docker run --rm -v "$PWD/package.json:/app/package.json" -v "$PWD/package-lock.json:/app/package-lock.json" -w /app node:24-bookworm-slim npm install --package-lock-only --ignore-scripts
  ```

### Por que um deploy não apaga dados

`prisma migrate deploy` aplica apenas as migrations de `prisma/migrations` que
ainda não constam na tabela `_prisma_migrations` do banco. Ele nunca reseta,
nunca apaga dados por conta própria e nunca gera migration nova. Migration já
aplicada não roda de novo; se o arquivo dela for alterado depois, o comando
acusa erro em vez de reaplicar.

Validado localmente com a imagem (banco com dados reais): redeploy sem mudança,
deploy com coluna nova e deploy com migration quebrada. Nos três, nenhum dado
foi perdido.

### Regras para mudar o banco com segurança

O risco está no **conteúdo** da migration, não no comando:

| Mudança | O que acontece se feita direto | Como fazer |
|---|---|---|
| Renomear coluna/tabela | Prisma gera "apaga e cria": perde os dados | Editar o `migration.sql` para `ALTER ... RENAME`, ou criar a nova, copiar e remover depois |
| Coluna nova obrigatória | `NOT NULL` sem default falha em tabela com dados | Default, ou preencher na própria migration |
| Índice/constraint única | Falha se já houver duplicados | Conferir e corrigir os dados antes |
| Remover coluna/tabela | Dado perdido | Em dois deploys: primeiro o código para de usar, depois remove |

1. Migration só é criada localmente (`npx prisma migrate dev`). Aviso de perda
   de dados do Prisma nunca é ignorado.
2. Revisar o `migration.sql` gerado antes de commitar.
3. Nunca rodar `migrate reset`, `db push` ou `migrate dev` contra dev/prd.
4. Nunca editar uma migration que já subiu para algum ambiente: criar outra.
5. Toda migration passa por dev antes de prd.
6. Durante o deploy, a versão antiga ainda atende enquanto a nova migra: a
   migration precisa ser compatível com o código anterior (mudanças aditivas;
   remoções em dois deploys, regra acima).

### Se uma migration falhar

O Prisma registra a falha e **bloqueia os próximos deploys** (erro `P3009`)
até alguém resolver. O container não sobe; a versão anterior segue no ar.

1. Ver o erro no log do container (Dokploy → Logs).
2. No PostgreSQL, a migration com erro é revertida por inteiro (roda em
   transação). Conferir se não sobrou nada aplicado pela metade.
3. Marcar como revertida, num container da imagem com a migration quebrada
   (terminal do Dokploy):
   ```bash
   prisma migrate resolve --rolled-back <nome_da_migration>
   ```
4. Corrigir a migration (nova pasta com outro nome) e fazer o deploy de novo.

Se o banco ficar inconsistente, restaurar o backup (seção 7).

### Ambiente local

`npx prisma migrate reset` recria o banco local do zero (**apaga tudo**) e
depois `npx prisma db seed` recria os planos. Nunca apontar para dev/prd.

## 4. Seed dos planos

Planos vendáveis: **Essencial** (R$ 99) e **Rede** (R$ 350), com limites
(`maxBranches`, `maxUsers`, `maxProducts`) em `prisma/seed.ts`. O trial não é um
plano: distribuidora nova testa por 14 dias com os limites do Essencial
(`DEFAULT_PLAN_CODE`).
Sem os planos no banco, o onboarding quebra.

```bash
npx prisma db seed   # idempotente (upsert), pode rodar a cada deploy
```

O seed roda a cada subida do container e **sobrescreve** preço e limites dos
planos com os valores de `prisma/seed.ts`: mudança de plano é feita no código,
nunca direto no banco de prd (seria desfeita no deploy seguinte).

### Assinatura manual (sem gateway)

Não há gateway de pagamento: o pagamento é confirmado fora do sistema e a
assinatura é ativada com o script abaixo, rodado no terminal do container do
backend no Dokploy (usa o `DATABASE_URL` do próprio container).

```bash
npm run subscription -- show --tenant <id ou CNPJ>
npm run subscription -- activate --tenant <id ou CNPJ> --plan ESSENCIAL --months 1
npm run subscription -- cancel --tenant <id ou CNPJ>
```

`activate` deixa a assinatura ACTIVE, soma os meses ao período vigente (ou a
partir de hoje) e registra a fatura como paga. Transições automáticas, aplicadas
na primeira requisição da distribuidora depois do vencimento (não há job):

- trial vencido → SUSPENDED;
- período pago vencido → PAST_DUE (acesso normal por 5 dias) → SUSPENDED.

SUSPENDED e CANCELED deixam a conta somente leitura: rotas que exigem escrita
respondem 403.

**Expurgo:** o job BullMQ `tenant-purge` roda todo dia às 03:00
(America/Sao_Paulo) e **exclui definitivamente** os dados das distribuidoras
canceladas há mais de 90 dias (`canceledAt`). As contas de usuário ficam. O
agendamento é registrado no Redis quando a API sobe (id fixo, não duplica com
várias instâncias). Reativar com `activate` antes do prazo cancela o expurgo.
Em dev/prd, garanta backup do PostgreSQL antes de depender desse job.

### Notificações por e-mail

- **Resumo diário:** job BullMQ `daily-digest` às 08:00 (America/Sao_Paulo). Envia a
  cada membro o dia anterior das filiais que ele acessa, conforme as preferências
  "Resumo diário" (conta) e "Alertas de estoque baixo" (por distribuidora).
  Contas suspensas ou canceladas não recebem. Reprocessar o job no mesmo dia não
  duplica e-mails.
- **Avisos de equipe:** proprietários e administradores com "Convites e mudanças
  de permissão" ligado recebem quando alguém entra na equipe ou troca de função.
- Os links dos e-mails usam `APP_URL`.

## 5. E-mail (Hostinger)

O envio sai por uma fila BullMQ processada **no mesmo processo** da API
(`src/mail/mail.processor.ts`): Redis precisa estar acessível e não há worker
separado para subir.

A caixa é `auth@debandeja.store`, comprada na Hostinger, e é a mesma em dev e
prd (os links de cada e-mail vêm do `APP_URL` do ambiente):

| Variável | Valor |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` / `SMTP_SECURE` | `465` / `true` (TLS direto). Alternativa: `587` / `false`, com STARTTLS obrigatório |
| `SMTP_USER` | `auth@debandeja.store` |
| `SMTP_PASS` | Senha da caixa (hPanel → E-mails → Contas de e-mail). Só no Dokploy |
| `MAIL_FROM` | `Debandeja <auth@debandeja.store>`: a Hostinger recusa remetente diferente da caixa autenticada |

- Ao subir, a API testa a conexão e registra no log `Conexão SMTP verificada`
  ou `Falha ao conectar no SMTP: ...` (senha errada aparece como
  `535 authentication failed`). A API sobe mesmo com falha; os e-mails ficam na
  fila tentando de novo.
- Local continua no Mailpit, sem usuário e senha (`.env.example`).

### DNS do domínio (entrega sem cair no spam)

No DNS de `debandeja.store` precisam existir os registros de e-mail da
Hostinger. Se o domínio usa o DNS da própria Hostinger, eles costumam ser
criados sozinhos; conferir em hPanel → E-mails → *Configurar/Status do DNS*:

- **MX** apontando para os servidores da Hostinger (recebimento da caixa).
- **SPF** (TXT em `@`) incluindo a Hostinger (`include:_spf.mail.hostinger.com`).
- **DKIM** (TXT/CNAME que o hPanel informa): assina os e-mails.
- **DMARC** (TXT em `_dmarc`), começando com `v=DMARC1; p=none; rua=mailto:auth@debandeja.store`.

Sem SPF e DKIM, Gmail e Outlook tendem a mandar confirmação de conta e convites
para o spam.

## 6. Checklist rápido

- [ ] Variáveis da seção 1 preenchidas; `JWT_SECRET` e `INTERNAL_API_TOKEN` exclusivos do ambiente
- [ ] `INTERNAL_API_TOKEN` idêntico no backend e no frontend
- [ ] `APP_URL` apontando para a URL pública do frontend
- [ ] Backend sem domínio público (só o frontend o alcança pela rede interna)
- [ ] Imagem do GHCR (`:dev` / `:latest`); logs do primeiro deploy mostram migration + seed + API no ar
- [ ] Secrets `DOKPLOY_DEV_WEBHOOK_URL` e `DOKPLOY_PROD_WEBHOOK_URL` no repositório; environment `production` com aprovação
- [ ] Uma réplica do backend; update config com `start-first` e rollback (seção 7)
- [ ] Backup diário do PostgreSQL configurado e restauração testada
- [ ] SMTP da Hostinger configurado e log mostrando `Conexão SMTP verificada`
- [ ] SPF, DKIM e DMARC de `debandeja.store` conferidos no hPanel

## 7. Dokploy + GitHub Actions

Mesmo modelo dos outros projetos da VPS: **o GitHub Actions monta a imagem e o
Dokploy só a executa.** Backend e frontend são repositórios separados, cada um
com `.github/workflows/docker-build.yml`.

```
push em develop ─► checks ─► imagem ghcr.io/<owner>/<repo>:dev    ─► webhook dev ─► Dokploy dev
push em main    ─► checks ─► imagem ghcr.io/<owner>/<repo>:latest ─► webhook prd ─► Dokploy prd
```

- **checks:** lint, typecheck e testes. Se falhar, não há imagem nem deploy.
- Toda imagem também recebe a tag do commit (`sha-<hash>`): para voltar a uma
  versão anterior, basta apontar o app no Dokploy para essa tag.
- No backend, o workflow emite um aviso quando o push traz **migration nova**.

### Serviços por ambiente

Um projeto no Dokploy para dev e outro para prd. Banco e Redis nunca são
compartilhados entre ambientes.

| Serviço | Tipo no Dokploy | Domínio público |
|---|---|---|
| PostgreSQL 17 | Database → PostgreSQL | Não |
| Redis 7 | Database → Redis | Não |
| Backend | Application, fonte **Docker image** `ghcr.io/<owner>/<repo-backend>:dev` (prd: `:latest`) | **Não** (só o frontend acessa) |
| Frontend | Application, fonte **Docker image** `ghcr.io/<owner>/<repo-frontend>:dev` (prd: `:latest`) | Sim, com HTTPS (Let's Encrypt): dev `dev.debandeja.store`, prd `debandeja.store` |

Pacotes do GHCR privados: cadastrar o registry `ghcr.io` no Dokploy com um
token do GitHub com permissão `read:packages`.

### Primeiro deploy

1. Criar PostgreSQL e Redis; anotar as URLs **internas**.
2. Backend: variáveis de `.env.dev.example` / `.env.prd.example` (este
   repositório). Deploy e esperar *healthy*: os logs mostram a migration, o seed
   e `Nest application successfully started`.
3. Frontend: variáveis de `.env.dev.example` / `.env.prd.example` do repositório
   do frontend, com `BACKEND_URL` apontando para o nome interno do backend.
   Domínio + HTTPS na porta 3000.
4. Em cada app, copiar a **Webhook URL** do Dokploy para os secrets do
   repositório no GitHub: `DOKPLOY_DEV_WEBHOOK_URL` e `DOKPLOY_PROD_WEBHOOK_URL`.

### Deploy sem derrubar o sistema (health check + rollback)

Nas configurações avançadas de cada app (Swarm Settings):

- **Health check:** as imagens já declaram `HEALTHCHECK`; não sobrescrever.
- **Update config** (sobe o novo antes de desligar o antigo; se falhar, volta):
  ```json
  { "Parallelism": 1, "Order": "start-first", "FailureAction": "rollback", "Monitor": 60000000000 }
  ```
- **Replicas: 1** no backend (seção 3).

Assim, migration que falha ou API que não sobe mantém a versão anterior no ar.

### Backup do banco (obrigatório em prd)

- Configurar um destino S3 (Settings → S3 Destinations) e, no serviço
  PostgreSQL, **backup agendado diário** com retenção de pelo menos 7 dias (prd:
  30 é o recomendado).
- **Backup manual antes de mesclar em `main` qualquer mudança com migration
  nova.** Para não depender de lembrar: em GitHub → Settings → Environments →
  `production`, ligar *Required reviewers*. O job de build em `main` passa a
  esperar aprovação, e essa pausa é o momento do backup.
- Testar uma restauração ao menos uma vez, num banco à parte: backup nunca
  restaurado não conta como backup.
- O expurgo diário (seção 4) apaga de verdade os dados de contas canceladas há
  mais de 90 dias; o backup é a única volta.

### Ordem entre backend e frontend

Os dois repositórios fazem deploy de forma independente. Toda mudança precisa
funcionar com a versão anterior do outro lado: o backend adiciona o que é novo
antes do frontend passar a usar, e só remove depois que o frontend parou de usar.

### Fluxo de cada nova versão

1. Desenvolvimento e migrations criadas localmente (regras da seção 3).
2. Merge em `develop` → deploy automático em **dev** → conferir logs e testar.
3. Se houver migration: backup manual do banco de **prd**.
4. Merge em `main` → deploy automático em **prd**.
