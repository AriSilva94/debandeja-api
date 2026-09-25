import 'dotenv/config';
import { parseArgs } from 'node:util';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { InvoiceStatus, SubscriptionStatus } from '../generated/prisma/enums';

const USAGE = `Uso:
  npm run subscription -- show --tenant <id ou CNPJ>
  npm run subscription -- activate --tenant <id ou CNPJ> --plan <ESSENCIAL|REDE> [--months 1]
  npm run subscription -- cancel --tenant <id ou CNPJ>`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    tenant: { type: 'string' },
    plan: { type: 'string' },
    months: { type: 'string', default: '1' },
  },
});

async function findSubscription(tenant: string) {
  const found = await prisma.tenant.findFirst({
    where: { OR: [{ id: tenant }, { cnpj: tenant }] },
    select: {
      id: true,
      legalName: true,
      trialEndsAt: true,
      subscription: { include: { plan: true } },
    },
  });
  if (!found?.subscription)
    throw new Error(`Distribuidora não encontrada: ${tenant}`);
  return { ...found, subscription: found.subscription };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function activate(tenant: string, planCode: string, months: number) {
  const { id, subscription } = await findSubscription(tenant);
  const plan = await prisma.plan.findUnique({ where: { code: planCode } });
  if (!plan) throw new Error(`Plano não encontrado: ${planCode}`);

  const now = new Date();
  const periodStart =
    subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
      ? subscription.currentPeriodEnd
      : now;
  const currentPeriodEnd = addMonths(periodStart, months);

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        planCode,
        currentPeriodEnd,
        canceledAt: null,
      },
    }),
    prisma.invoice.create({
      data: {
        tenantId: id,
        subscriptionId: subscription.id,
        description: `Plano ${plan.name} — ${months} ${months === 1 ? 'mês' : 'meses'}`,
        amount: plan.price.mul(months),
        status: InvoiceStatus.PAGO,
      },
    }),
  ]);
  console.log(
    `Plano ${plan.name} ativo até ${currentPeriodEnd.toLocaleDateString('pt-BR')}.`,
  );
}

async function cancel(tenant: string) {
  const { subscription } = await findSubscription(tenant);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
  });
  console.log(
    'Assinatura cancelada: a conta fica somente leitura e os dados são excluídos em 90 dias.',
  );
}

async function show(tenant: string) {
  const { id, legalName, trialEndsAt, subscription } =
    await findSubscription(tenant);
  console.table({
    id,
    legalName,
    status: subscription.status,
    plan: subscription.plan.name,
    trialEndsAt: trialEndsAt?.toISOString() ?? '—',
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? '—',
  });
}

async function main() {
  const [command] = positionals;
  const months = Number(values.months);
  if (!values.tenant || !Number.isInteger(months) || months < 1) {
    throw new Error(USAGE);
  }
  if (command === 'show') return show(values.tenant);
  if (command === 'cancel') return cancel(values.tenant);
  if (command === 'activate' && values.plan) {
    return activate(values.tenant, values.plan.toUpperCase(), months);
  }
  throw new Error(USAGE);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
