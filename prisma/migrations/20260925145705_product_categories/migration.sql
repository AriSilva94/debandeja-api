-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE EXTENSION IF NOT EXISTS unaccent;

INSERT INTO "product_categories" ("id", "tenantId", "name", "normalizedName")
SELECT gen_random_uuid()::TEXT, "tenantId", "name", "normalizedName"
FROM (
    SELECT DISTINCT ON ("tenantId", "normalizedName")
        "tenantId",
        regexp_replace(btrim("category"), '\s+', ' ', 'g') AS "name",
        lower(regexp_replace(btrim(unaccent("category")), '\s+', ' ', 'g')) AS "normalizedName"
    FROM "products"
    ORDER BY "tenantId", "normalizedName", "name"
) AS "existing_categories";

-- AlterTable
ALTER TABLE "products" ADD COLUMN "categoryId" TEXT;

UPDATE "products" AS "product"
SET "categoryId" = "category"."id"
FROM "product_categories" AS "category"
WHERE "category"."tenantId" = "product"."tenantId"
  AND "category"."normalizedName" = lower(regexp_replace(btrim(unaccent("product"."category")), '\s+', ' ', 'g'));

ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "products" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "product_categories_tenantId_name_idx" ON "product_categories"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_tenantId_normalizedName_key" ON "product_categories"("tenantId", "normalizedName");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
