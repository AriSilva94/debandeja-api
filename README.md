# Debandeja API

API NestJS do Debandeja (SaaS de estoque e operação para distribuidoras de
bebidas). PostgreSQL via Prisma é a fonte de verdade; Redis sustenta as filas
BullMQ (e-mails, resumo diário e expurgo). Só o BFF do frontend (`../frontend`)
chama esta API.

## Executar localmente

```bash
docker compose up -d          # PostgreSQL (5434), Redis (6380) e Mailpit (8026)
cp .env.example .env          # preencher JWT_SECRET e INTERNAL_API_TOKEN
npm install
npx prisma migrate deploy     # cria as tabelas
npx prisma db seed            # cria os planos
npm run start:dev             # API em http://localhost:3333
```

E-mails locais (confirmação de conta, convites, resumos) chegam no Mailpit:
[http://localhost:8026](http://localhost:8026).

## Validação

```bash
npm run lint
npx tsc --noEmit -p tsconfig.json
npm test
npm run build
```

## Deploy

Imagem Docker montada pelo GitHub Actions e executada no Dokploy; a cada subida
aplica as migrations pendentes e o seed. Variáveis, regras para mudar o banco
com segurança, backup e passo a passo em [`docs/deploy.md`](docs/deploy.md).
