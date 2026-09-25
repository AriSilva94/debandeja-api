import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PLANS = [
  {
    code: 'ESSENCIAL',
    name: 'Essencial',
    price: 99,
    maxUsers: 3,
    maxBranches: 1,
    maxProducts: 1500,
    features: ['1 filial', 'Até 3 usuários', 'Até 1.500 produtos', 'Suporte por e-mail'],
  },
  {
    code: 'REDE',
    name: 'Rede',
    price: 350,
    maxUsers: null,
    maxBranches: null,
    maxProducts: null,
    features: ['Filiais ilimitadas', 'Usuários ilimitados', 'Produtos ilimitados', 'Suporte dedicado'],
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
  console.log(`Seed de planos concluído: ${PLANS.map((p) => p.code).join(', ')}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
