-- pgvector is needed for knowledge_chunks.embedding (also enabled by docker/init for fresh volumes).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'MANAGER');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('STANDARD', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('STORE', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'READY_FOR_PICKUP', 'SHIPPED', 'DELAYED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('INVENTORY', 'SUPPORT', 'PROMOTION');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'EXECUTED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "membershipTier" "MembershipTier" NOT NULL DEFAULT 'STANDARD',
    "country" CHAR(2) NOT NULL DEFAULT 'IN',
    "preferredStoreId" INTEGER,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "city" VARCHAR(60) NOT NULL,
    "type" "StoreType" NOT NULL DEFAULT 'STORE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "brand" VARCHAR(40) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "storeId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "onHand" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "incomingQty" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL,
    "safetyStock" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("storeId","productId")
);

-- CreateTable
CREATE TABLE "sales_daily" (
    "storeId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "saleDate" DATE NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "sales_daily_pkey" PRIMARY KEY ("storeId","productId","saleDate")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("cartId","productId")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "userId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "fulfilment" "Fulfilment" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAID',
    "statusNote" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "expectedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "documentId" VARCHAR(80) NOT NULL,
    "documentTitle" VARCHAR(160) NOT NULL,
    "docType" VARCHAR(30) NOT NULL,
    "section" VARCHAR(160) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "region" CHAR(2) NOT NULL DEFAULT 'IN',
    "category" VARCHAR(40),
    "tier" VARCHAR(10) NOT NULL DEFAULT 'ALL',
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "embedding" vector(384),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" SERIAL NOT NULL,
    "agent" "AgentType" NOT NULL,
    "actionType" VARCHAR(30) NOT NULL,
    "storeId" INTEGER,
    "productId" INTEGER,
    "payload" JSONB NOT NULL,
    "explanation" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "actorEmail" VARCHAR(120),
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(60) NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" SERIAL NOT NULL,
    "feature" VARCHAR(30) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "userId" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_price_idx" ON "products"("category", "price");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "inventory_productId_idx" ON "inventory"("productId");

-- CreateIndex
CREATE INDEX "sales_daily_storeId_saleDate_idx" ON "sales_daily"("storeId", "saleDate");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_storeId_idx" ON "orders"("storeId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_productId_key" ON "order_items"("orderId", "productId");

-- CreateIndex
CREATE INDEX "knowledge_chunks_region_tier_effectiveDate_idx" ON "knowledge_chunks"("region", "tier", "effectiveDate");

-- CreateIndex
CREATE INDEX "knowledge_chunks_docType_idx" ON "knowledge_chunks"("docType");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_documentId_version_chunkIndex_key" ON "knowledge_chunks"("documentId", "version", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "agent_actions_idempotencyKey_key" ON "agent_actions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agent_actions_status_createdAt_idx" ON "agent_actions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "agent_actions_storeId_idx" ON "agent_actions"("storeId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_call_logs_feature_createdAt_idx" ON "ai_call_logs"("feature", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_preferredStoreId_fkey" FOREIGN KEY ("preferredStoreId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_daily" ADD CONSTRAINT "sales_daily_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_daily" ADD CONSTRAINT "sales_daily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_call_logs" ADD CONSTRAINT "ai_call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data rules Prisma cannot express in the schema (added by hand).
ALTER TABLE "products"    ADD CONSTRAINT "products_price_check"  CHECK ("price" >= 0 AND "cost" >= 0);
ALTER TABLE "products"    ADD CONSTRAINT "products_rating_check" CHECK ("rating" BETWEEN 0 AND 5);
ALTER TABLE "inventory"   ADD CONSTRAINT "inventory_qty_check"
  CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand" AND "incomingQty" >= 0
         AND "reorderPoint" >= 0 AND "safetyStock" >= 0 AND "leadTimeDays" > 0);
ALTER TABLE "sales_daily" ADD CONSTRAINT "sales_daily_qty_check" CHECK ("qty" > 0);
ALTER TABLE "cart_items"  ADD CONSTRAINT "cart_items_qty_check"  CHECK ("qty" BETWEEN 1 AND 10);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_qty_check" CHECK ("qty" > 0 AND "unitPrice" >= 0);
ALTER TABLE "orders"      ADD CONSTRAINT "orders_money_check"
  CHECK ("subtotal" >= 0 AND "deliveryFee" >= 0 AND "total" = "subtotal" + "deliveryFee");
ALTER TABLE "users"       ADD CONSTRAINT "users_email_lower_check" CHECK ("email" = lower("email"));
