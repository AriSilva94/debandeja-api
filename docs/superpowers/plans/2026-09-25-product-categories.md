# Product Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um catálogo plano de categorias por distribuidora, usado por produtos e pesquisável/criável no cadastro.

**Architecture:** O PostgreSQL passa a manter `ProductCategory` tenant-scoped e `Product.categoryId` como relação obrigatória. NestJS expõe a lista e criação com a permissão de produtos; o frontend usa um combobox local, envia ids e invalida a query de categorias após criar.

**Tech Stack:** Prisma 7/PostgreSQL, NestJS 11, class-validator, Next.js 16, React Query, Vitest e Jest.

---

### Task 1: Modelar e migrar o catálogo no PostgreSQL

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_product_categories/migration.sql`

- [ ] **Step 1: Write failing service test**

```ts
it('lists default categories created with the tenant', async () => {
  await service.createCompany('user-1', { legalName: 'Distribuidora', cnpj: undefined, tradeName: undefined });
  expect(prisma.tenant.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ productCategories: { createMany: expect.any(Object) } }),
  }));
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- onboarding.service.spec.ts`

- [ ] **Step 3: Add schema and migration**

```prisma
model ProductCategory {
  id String @id @default(uuid())
  tenantId String
  name String
  normalizedName String
  active Boolean @default(true)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products Product[]
  @@unique([tenantId, normalizedName])
  @@index([tenantId, name])
  @@map("product_categories")
}
```

Migration: criar tabela, popular categorias distintas atuais por tenant, adicionar `products.categoryId`, preencher por nome normalizado, marcar como `NOT NULL`, criar FK e remover `products.category`.

- [ ] **Step 4: Run Prisma generation and test**

Run: `npx prisma generate && npm test -- onboarding.service.spec.ts`

### Task 2: Criar API de categorias e vincular produtos

**Files:**
- Create: `src/products/dto/create-product-category.dto.ts`
- Modify: `src/products/dto/create-product.dto.ts`
- Modify: `src/products/dto/update-product.dto.ts`
- Modify: `src/products/products.service.ts`
- Modify: `src/products/products.controller.ts`
- Test: `src/products/products.service.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('creates a normalized tenant category', async () => {
  await service.createCategory('tenant-1', { name: 'Águas' });
  expect(prisma.productCategory.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ tenantId: 'tenant-1', normalizedName: 'aguas' }),
  }));
});

it('rejects a category from another tenant when creating a product', async () => {
  await expect(service.create(tenant, { categoryId: 'other-category' } as CreateProductDto)).rejects.toThrow('Categoria não encontrada');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- products.service.spec.ts`

- [ ] **Step 3: Implement API and ownership validation**

`GET /products/categories` returns `{ id, name }[]`; `POST /products/categories` requires `PRODUCTS:WRITE`; DTO accepts `name` with 2–80 chars. Product DTOs use `categoryId`; list/filter/list rows join category name; create, update and duplicate connect the owned active category.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- products.service.spec.ts && npx tsc --noEmit -p tsconfig.json`

### Task 3: Criar categorias padrão no onboarding

**Files:**
- Create: `src/common/constants/product-categories.ts`
- Modify: `src/onboarding/onboarding.service.ts`
- Test: `src/onboarding/onboarding.service.spec.ts`

- [ ] **Step 1: Write failing test for tenant category seeding**

```ts
expect(prisma.tenant.create).toHaveBeenCalledWith(expect.objectContaining({
  data: expect.objectContaining({ productCategories: { createMany: { data: DEFAULT_PRODUCT_CATEGORIES } } }),
}));
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- onboarding.service.spec.ts`

- [ ] **Step 3: Implement initial category list**

Export the approved flat list, each item with display name and normalized value; use nested `createMany` in `createCompany`.

- [ ] **Step 4: Run test and backend suite**

Run: `npm test`

### Task 4: Atualizar contrato e hooks do frontend

**Files:**
- Modify: `../frontend/.worktrees/product-categories/lib/api/types.ts`
- Modify: `../frontend/.worktrees/product-categories/lib/api/hooks/use-products.ts`
- Test: `../frontend/.worktrees/product-categories/components/__tests__/interactive-surfaces.test.tsx`

- [ ] **Step 1: Write failing frontend test**

```tsx
expect(screen.getByRole('combobox', { name: 'Categoria' })).toBeTruthy();
expect(screen.getByRole('option', { name: 'Cervejas' })).toBeTruthy();
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- components/__tests__/interactive-surfaces.test.tsx`

- [ ] **Step 3: Update types and hooks**

Define `ProductCategory { id; name }`; replace `category` with `categoryId` in `ProductInput`; add `useCreateProductCategory` that invalidates `['products', 'categories']`.

- [ ] **Step 4: Run frontend typecheck**

Run: `npm run typecheck`

### Task 5: Implementar combobox e criação explícita

**Files:**
- Create: `../frontend/.worktrees/product-categories/components/products/category-combobox.tsx`
- Modify: `../frontend/.worktrees/product-categories/components/products/new-product-drawer.tsx`
- Modify: `../frontend/.worktrees/product-categories/components/__tests__/interactive-surfaces.test.tsx`

- [ ] **Step 1: Write failing tests for search and create**

```tsx
fireEvent.change(screen.getByRole('combobox', { name: 'Categoria' }), { target: { value: 'ener' } });
expect(screen.getByRole('option', { name: 'Energéticos' })).toBeTruthy();
expect(screen.getByRole('button', { name: /Adicionar “Energia”/ })).toBeTruthy();
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- components/__tests__/interactive-surfaces.test.tsx`

- [ ] **Step 3: Implement combobox**

Reuse `CityCombobox` interaction conventions: normalized filtering, `role=combobox`, listbox, arrows, Enter, Escape and click-outside. Show the create action only for a valid query with no exact normalized match; select successful POST result and provide an inline error/retry path.

- [ ] **Step 4: Run test and verify pass**

Run: `npm test -- components/__tests__/interactive-surfaces.test.tsx`

### Task 6: Verificar a integração

**Files:**
- Modify: somente arquivos acima necessários para corrigir verificações

- [ ] **Step 1: Run backend quality checks**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm test`

- [ ] **Step 2: Run frontend quality checks**

Run: `npm run lint && npm run typecheck && npm test`

- [ ] **Step 3: Review migrations and UI changes**

Run: `git diff --check` in both repositories and `node C:/Users/ariov/.agents/skills/impeccable/scripts/detect.mjs --json components/products/new-product-drawer.tsx` in frontend.
