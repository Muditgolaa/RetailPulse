import { api } from "./client";
import type { Facets, Page, Product, ProductDetail, Store } from "../types";

export type ProductQuery = {
  q?: string; category?: string; brand?: string; minPrice?: number; maxPrice?: number;
  storeId?: number; inStock?: boolean; sort?: string; page?: number; size?: number;
};

// Catalogue reads come from PostgreSQL through the backend.
export const listStores = async () => (await api.get<Store[]>("/stores")).data;

export const listProducts = async (params: ProductQuery) => (await api.get<Page<Product>>("/products", { params })).data;

export const getProduct = async (sku: string) => (await api.get<ProductDetail>(`/products/${encodeURIComponent(sku)}`)).data;

export const getFacets = async () => (await api.get<Facets>("/products/facets")).data;
