import type { ProductDto } from "../../shared/types";
import type { StorageProvider } from "../adapters/storage/types";
import { AppError } from "../domain/errors";
import { newId } from "../domain/ids";
import type { Repositories } from "../repositories";
import type { CategoryData, ProductData, ProductFilter, ProductRow, SupplierData } from "../repositories/catalog";
import type { Actor } from "./context";
import { guarded } from "./tx";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Categories, suppliers and products (incl. images in object storage). */
export class CatalogService {
  constructor(
    private readonly repos: Repositories,
    private readonly storage: StorageProvider,
  ) {}

  private audit(actor: Actor, action: string, entityType: string, entityId: string, details?: unknown) {
    return this.repos.identity.insertAudit({ tenantId: actor.tenantId, userId: actor.userId, action, entityType, entityId, details, ipAddress: actor.ipAddress });
  }

  private toProductDto(row: ProductRow): ProductDto {
    const { imageKey, ...rest } = row;
    return {
      ...rest,
      // relative URL: works on workers.dev, custom domains and any other host
      imageUrl: imageKey ? `/files/${imageKey}` : null,
      isLowStock: row.status === "ACTIVE" && row.minStock > 0 && row.totalQuantity < row.minStock,
    };
  }

  // ---- categories
  listCategories(actor: Actor) {
    return this.repos.catalog.listCategories(actor.tenantId);
  }

  async createCategory(actor: Actor, data: CategoryData) {
    const id = await guarded(() => this.repos.catalog.createCategory(actor.tenantId, data));
    await this.audit(actor, "category.created", "product_category", id, { code: data.code });
    return this.repos.catalog.getCategory(actor.tenantId, id);
  }

  async updateCategory(actor: Actor, id: string, data: CategoryData) {
    if (!(await this.repos.catalog.getCategory(actor.tenantId, id))) throw new AppError("NOT_FOUND", "Category not found");
    await guarded(() => this.repos.catalog.updateCategory(actor.tenantId, id, data));
    await this.audit(actor, "category.updated", "product_category", id);
    return this.repos.catalog.getCategory(actor.tenantId, id);
  }

  async deleteCategory(actor: Actor, id: string) {
    const category = await this.repos.catalog.getCategory(actor.tenantId, id);
    if (!category) throw new AppError("NOT_FOUND", "Category not found");
    if (category.productCount > 0) throw new AppError("IN_USE", "Category still has products");
    await this.repos.catalog.deleteCategory(actor.tenantId, id);
    await this.audit(actor, "category.deleted", "product_category", id);
  }

  // ---- suppliers
  listSuppliers(actor: Actor, search?: string) {
    return this.repos.catalog.listSuppliers(actor.tenantId, search);
  }

  async createSupplier(actor: Actor, data: SupplierData) {
    const id = await guarded(() => this.repos.catalog.createSupplier(actor.tenantId, data));
    await this.audit(actor, "supplier.created", "supplier", id, { code: data.code });
    return this.repos.catalog.getSupplier(actor.tenantId, id);
  }

  async updateSupplier(actor: Actor, id: string, data: SupplierData) {
    if (!(await this.repos.catalog.getSupplier(actor.tenantId, id))) throw new AppError("NOT_FOUND", "Supplier not found");
    await guarded(() => this.repos.catalog.updateSupplier(actor.tenantId, id, data));
    await this.audit(actor, "supplier.updated", "supplier", id);
    return this.repos.catalog.getSupplier(actor.tenantId, id);
  }

  async deleteSupplier(actor: Actor, id: string) {
    if (!(await this.repos.catalog.getSupplier(actor.tenantId, id))) throw new AppError("NOT_FOUND", "Supplier not found");
    await this.repos.catalog.deleteSupplier(actor.tenantId, id);
    await this.audit(actor, "supplier.deleted", "supplier", id);
  }

  // ---- products
  async listProducts(actor: Actor, filter: ProductFilter) {
    const res = await this.repos.catalog.listProducts(actor.tenantId, filter);
    return { items: res.items.map((r) => this.toProductDto(r)), meta: res.meta };
  }

  productOptions(actor: Actor, search?: string) {
    return this.repos.catalog.listProductOptions(actor.tenantId, search);
  }

  async getProduct(actor: Actor, id: string): Promise<ProductDto> {
    const row = await this.repos.catalog.getProduct(actor.tenantId, id);
    if (!row) throw new AppError("NOT_FOUND", "Product not found");
    return this.toProductDto(row);
  }

  private async checkCategory(actor: Actor, categoryId: string | null) {
    if (categoryId && !(await this.repos.catalog.getCategory(actor.tenantId, categoryId))) {
      throw new AppError("VALIDATION_ERROR", "Category not found", { field: "categoryId" });
    }
  }

  async createProduct(actor: Actor, data: ProductData) {
    await this.checkCategory(actor, data.categoryId);
    const id = await guarded(() => this.repos.catalog.createProduct(actor.tenantId, data));
    await this.audit(actor, "product.created", "product", id, { sku: data.sku });
    return this.getProduct(actor, id);
  }

  async updateProduct(actor: Actor, id: string, data: ProductData) {
    await this.getProduct(actor, id);
    await this.checkCategory(actor, data.categoryId);
    await guarded(() => this.repos.catalog.updateProduct(actor.tenantId, id, data));
    await this.audit(actor, "product.updated", "product", id, { sku: data.sku });
    return this.getProduct(actor, id);
  }

  async archiveProduct(actor: Actor, id: string) {
    const product = await this.getProduct(actor, id);
    if (product.totalQuantity > 0) throw new AppError("IN_USE", "Product still has stock");
    await this.repos.catalog.archiveProduct(actor.tenantId, id);
    await this.audit(actor, "product.archived", "product", id);
    return this.getProduct(actor, id);
  }

  async restoreProduct(actor: Actor, id: string) {
    await this.getProduct(actor, id);
    await this.repos.catalog.restoreProduct(actor.tenantId, id);
    await this.audit(actor, "product.restored", "product", id);
    return this.getProduct(actor, id);
  }

  async uploadImage(actor: Actor, id: string, file: File) {
    const product = await this.getProduct(actor, id);
    if (!this.storage.available) throw new AppError("STORAGE_UNAVAILABLE", "File storage is not configured");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new AppError("VALIDATION_ERROR", "Unsupported image type", { field: "file" });
    if (file.size > MAX_IMAGE_BYTES) throw new AppError("VALIDATION_ERROR", "Image too large (max 2MB)", { field: "file" });
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // tenant-prefixed key; new key per upload so files can be cached immutably
    const key = `t/${actor.tenantId}/products/${id}/${newId()}.${ext}`;
    await this.storage.put(key, await file.arrayBuffer(), file.type);
    const oldKey = product.imageUrl?.replace(/^\/files\//, "");
    await this.repos.catalog.setProductImage(actor.tenantId, id, key);
    if (oldKey) await this.storage.delete(oldKey);
    await this.audit(actor, "product.image_uploaded", "product", id);
    return this.getProduct(actor, id);
  }

  async removeImage(actor: Actor, id: string) {
    const product = await this.getProduct(actor, id);
    const oldKey = product.imageUrl?.replace(/^\/files\//, "");
    await this.repos.catalog.setProductImage(actor.tenantId, id, null);
    if (oldKey) await this.storage.delete(oldKey);
    return this.getProduct(actor, id);
  }

  /** Serves a stored file only if it belongs to the caller's tenant. */
  async readFile(actor: Actor, key: string) {
    if (!key.startsWith(`t/${actor.tenantId}/`)) throw new AppError("NOT_FOUND", "File not found");
    const obj = await this.storage.get(key);
    if (!obj) throw new AppError("NOT_FOUND", "File not found");
    return obj;
  }
}
