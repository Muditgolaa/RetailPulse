import { api } from "./client.js";

// Catalogue reads come from PostgreSQL through the backend.
export const listStores = async () => (await api.get("/stores")).data;

export const listProducts = async (params) => (await api.get("/products", { params })).data;

export const getProduct = async (sku) => (await api.get(`/products/${encodeURIComponent(sku)}`)).data;

export const getFacets = async () => (await api.get("/products/facets")).data;
