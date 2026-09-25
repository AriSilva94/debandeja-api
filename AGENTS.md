API do Debandeja: SaaS multi-tenant de estoque e operação para distribuidoras de
bebidas. Monólito modular NestJS; o único cliente é o BFF do frontend
(`../frontend`), que repassa as chamadas com a sessão em cookies httpOnly.

## Arquitetura

* PostgreSQL via Prisma é a fonte de verdade.
* Redis só para infraestrutura: filas BullMQ (e-mail, resumo diário, expurgo) e
  locks/cache quando houver necessidade concreta. Nunca estado crítico.
* Jobs consultam o PostgreSQL antes de agir e são idempotentes.
* Sem microserviços e sem abstrações antecipadas.

## Regras que não podem ser quebradas

* Nunca confiar no `tenantId` enviado pelo cliente: o `TenantGuard` resolve a
  membership do usuário autenticado e só então libera a distribuidora.
* Todo dado é isolado por tenant; filiais respeitam o escopo do membro
  (`resolveBranchScope`).
* Autorização pelo `PermissionsGuard` + `@RequirePermission` (matriz em
  `common/permissions/permission-matrix.ts`). Conta suspensa/cancelada é
  somente leitura.
* Operações que dependem de contagem do tenant (limites do plano) rodam em
  transação com `lockTenant` + `assertPlanAllows`.
* Validação de entrada em DTOs com class-validator; mensagens de erro em pt-BR.
* HTML de e-mail sempre escapado (helper `h()` em `mail/mail-sender.service.ts`).

## Banco e migrations

* Migration só é criada localmente (`npx prisma migrate dev`) e o `migration.sql`
  é revisado antes do commit.
* Nunca `migrate reset`, `db push` ou `migrate dev` contra dev/prd; nunca editar
  migration já aplicada em algum ambiente.
* Mudanças destrutivas (renomear, remover) seguem as regras de
  `docs/deploy.md` (seção 3): o deploy aplica migrations automaticamente.

## Validação antes de concluir

`npm run lint`, `npx tsc --noEmit -p tsconfig.json` e `npm test`.

## Deploy

Ao responder sobre deploy em dev/prd (o que configurar, variáveis, ordem do
pipeline), leia primeiro `docs/deploy.md` deste projeto e `../frontend/docs/deploy.md`.
Mantenha esses guias atualizados sempre que uma mudança criar requisito de
deploy novo (variável de ambiente, migration especial, serviço externo, limite
de infraestrutura).
