jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { OnboardingService } from './onboarding.service';
import { DEFAULT_PRODUCT_CATEGORIES } from '../common/constants/product-categories';

describe('OnboardingService', () => {
  it('cria as categorias padrão junto com a distribuidora', async () => {
    type TenantCreateArgs = {
      data: {
        productCategories?: {
          createMany?: { data: typeof DEFAULT_PRODUCT_CATEGORIES };
        };
      };
    };
    const create = jest
      .fn<Promise<{ id: string; trialEndsAt: Date }>, [TenantCreateArgs]>()
      .mockResolvedValue({
        id: 'tenant-1',
        trialEndsAt: new Date('2026-10-09T00:00:00.000Z'),
      });
    const prisma = {
      tenant: {
        create,
      },
    };
    const service = new OnboardingService(prisma as never);

    await service.createCompany('user-1', {
      legalName: 'Distribuidora Exemplo',
    });

    expect(create.mock.calls[0][0].data.productCategories).toEqual({
      createMany: { data: DEFAULT_PRODUCT_CATEGORIES },
    });
  });
});
