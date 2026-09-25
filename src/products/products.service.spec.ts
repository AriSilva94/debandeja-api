jest.mock('../../generated/prisma/client', () => ({
  Prisma: {
    empty: {},
    join: jest.fn(),
    sql: jest.fn(),
  },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../stock/stock.service', () => ({
  StockService: class StockService {},
}));

import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('rejeita uma categoria de outro tenant ao criar um produto', async () => {
    const tx = {
      productCategory: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const transaction = jest.fn(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
    );
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: transaction,
    };
    const service = new ProductsService(prisma as never, {} as never);

    await expect(
      service.create(
        {
          tenantId: 'tenant-1',
          allowedBranchIds: null,
        } as never,
        {
          name: 'Produto',
          categoryId: 'category-2',
          price: 10,
        },
      ),
    ).rejects.toEqual(new NotFoundException('Categoria não encontrada'));
  });
});
