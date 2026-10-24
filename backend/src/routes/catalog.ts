import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import type { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../lib/http.js";
import { availability } from "../lib/stock.js";

export const catalogRouter = Router();

const SORTS = {
  "rating,desc": [{ rating: "desc" }, { id: "asc" }],
  "price,asc": [{ price: "asc" }, { id: "asc" }],
  "price,desc": [{ price: "desc" }, { id: "asc" }],
  "name,asc": [{ name: "asc" }, { id: "asc" }],
} satisfies Record<string, Prisma.ProductOrderByWithRelationInput[]>;

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().max(80).optional());
const optionalNumber = z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional());

const listQuery = z
  .object({
    q: optionalText,
    category: optionalText,
    brand: optionalText,
    minPrice: optionalNumber,
    maxPrice: optionalNumber,
    storeId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    inStock: z.preprocess(emptyToUndefined, z.stringbool().optional()),
    sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS]).default("rating,desc"),
    page: z.coerce.number().int().min(0).default(0),
    size: z.coerce.number().int().min(1).max(48).default(12),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "minPrice must not be greater than maxPrice",
    path: ["minPrice"],
  });

// Decimal columns → plain numbers for JSON.
const toProductDto = (p: { price: Prisma.Decimal; rating: Prisma.Decimal; cost?: unknown }) => {
  const { cost: _cost, ...rest } = p;
  return { ...rest, price: Number(p.price), rating: Number(p.rating) };
};

catalogRouter.get("/stores", async (_req, res) => {
  const stores = await prisma.store.findMany({ select: { id: true, code: true, name: true, city: true }, orderBy: { id: "asc" } });
  res.json(stores);
});

catalogRouter.get("/products/facets", async (_req, res) => {
  const [categories, brands, range] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
    prisma.product.findMany({ where: { active: true }, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    prisma.product.aggregate({ where: { active: true }, _min: { price: true }, _max: { price: true } }),
  ]);
  res.json({
    categories: categories.map((c) => c.category),
    brands: brands.map((b) => b.brand).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    priceRange: { min: Number(range._min.price ?? 0), max: Number(range._max.price ?? 0) },
  });
});

catalogRouter.get("/products", async (req, res) => {
  const f = listQuery.parse(req.query);
  if (f.inStock && !f.storeId) throw new HttpError(400, "inStock requires storeId");
  if (f.storeId && !(await prisma.store.findUnique({ where: { id: f.storeId } }))) throw new HttpError(400, "Unknown storeId");

  const where: Prisma.ProductWhereInput = {
    active: true,
    category: f.category,
    brand: f.brand,
    price: { gte: f.minPrice, lte: f.maxPrice },
    ...(f.q && {
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { brand: { contains: f.q, mode: "insensitive" } },
        { category: { contains: f.q, mode: "insensitive" } },
      ],
    }),
    // available = onHand - reserved > 0, compared column-to-column in SQL
    ...(f.inStock && { inventory: { some: { storeId: f.storeId, onHand: { gt: prisma.inventory.fields.reserved } } } }),
  };

  const [totalElements, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: SORTS[f.sort],
      skip: f.page * f.size,
      take: f.size,
      // Only the selected store's stock row; no store selected → no rows.
      include: { inventory: { where: { storeId: f.storeId ?? -1 } } },
    }),
  ]);

  res.json({
    content: rows.map(({ inventory, ...p }) => ({
      ...toProductDto(p),
      ...(f.storeId && { availability: availability(inventory[0]) }),
    })),
    totalElements,
    totalPages: Math.max(1, Math.ceil(totalElements / f.size)),
    number: f.page,
    size: f.size,
  });
});

// Accepts the SKU (P101) or the numeric id.
const productParam = z.string().trim().regex(/^(\d+|[A-Za-z0-9-]{1,20})$/, "Invalid product id");

catalogRouter.get("/products/:id", async (req, res) => {
  const id = productParam.parse(req.params.id);
  const product = await prisma.product.findFirst({
    where: { active: true, ...(/^\d+$/.test(id) ? { id: Number(id) } : { sku: id.toUpperCase() }) },
    include: { inventory: { include: { store: true }, orderBy: { storeId: "asc" } } },
  });
  if (!product) throw new HttpError(404, "Product not found");

  const { inventory, ...p } = product;
  res.json({
    ...toProductDto(p),
    availability: inventory.map((i) => ({
      storeId: i.storeId,
      storeCode: i.store.code,
      storeName: i.store.name,
      city: i.store.city,
      ...availability(i),
    })),
  });
});
