import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY_SELECT = {
  legalName: true,
  tradeName: true,
  cnpj: true,
  phone: true,
  contactEmail: true,
  address: true,
  city: true,
  uf: true,
  zip: true,
  stateRegistration: true,
  taxRegime: true,
} as const;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  get(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: COMPANY_SELECT,
    });
  }

  update(tenantId: string, dto: UpdateCompanyDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
      select: COMPANY_SELECT,
    });
  }
}
