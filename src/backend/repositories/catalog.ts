import type { ActiveStatus, ProductStatus } from "../../shared/constants";
import type { CategoryDto, PageMeta, SupplierDto } from "../../shared/types";
import type { SqlDatabase } from "../adapters/db/types";
import { newId } from "../domain/ids";
import { NOW_SQL, Where, likePattern, paginate, type PageRequest } from "./base";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  description: string | null;
  imageKey: string | null;
  minStock: number;
  maxStock: number | null;
  status: ProductStatus;
  totalQuantity: number;
  lotCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductData {
  sku: string;
  name: string;
  categoryId: string | null;
  barcode: string | null;
  unit: string;
  description: string | null;
  minStock: number;
  maxStock: number | null;
  status: ProductStatus;
}

export interface CategoryData {
  code: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
}

export interface SupplierData {
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: ActiveStatus;
}

export interface ProductFilter extends PageRequest {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  lowStock?: boolean;
}

/** Categories, suppliers and products. */
export interface CatalogRepository {
  listCategories(tenantId: string): Promise<CategoryDto[]>;
  getCategory(tenantId: string, id: string): Promise<CategoryDto | null>;
  createCategory(tenantId: string, data: CategoryData): Promise<string>;
  updateCategory(tenantId: string, id: string, data: CategoryData): Promise<void>;
  deleteCategory(tenantId: string, id: string): Promise<void>;
  listSuppliers(tenantId: string, search?: string): Promise<SupplierDto[]>;
  getSupplier(tenantId: string, id: string): Promise<SupplierDto | null>;
  createSupplier(tenantId: string, data: SupplierData): Promise<string>;
  updateSupplier(tenantId: string, id: string, data: SupplierData): Promise<void>;
  deleteSupplier(tenantId: string, id: string): Promise<void>;
  listProducts(tenantId: string, filter: ProductFilter): Promise<{ items: ProductRow[]; meta: PageMeta }>;
  listProductOptions(tenantId: string, search?: string): Promise<{ id: string; sku: string; name: string; unit: string; available: number }[]>;
  getProduct(tenantId: string, id: string): Promise<ProductRow | null>;
  createProduct(tenantId: string, data: ProductData): Promise<string>;
  updateProduct(tenantId: string, id: string, data: ProductData): Promise<void>;
  archiveProduct(tenantId: string, id: string): Promise<void>;
  restoreProduct(tenantId: string, id: string): Promise<void>;
  setProductImage(tenantId: string, id: string, imageKey: string | null): Promise<void>;
}

const PRODUCT_SELECT = `p.id, p.sku, p.name, p.barcode, p.category_id AS categoryId, c.name AS categoryName, p.unit, p.description,
  p.image_key AS imageKey, p.min_stock AS minStock, p.max_stock AS maxStock, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt,
  COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.product_id = p.id), 0) AS totalQuantity,
  (SELECT COUNT(DISTINCT ib.lot_id) FROM inventory_balances ib WHERE ib.product_id = p.id AND ib.quantity > 0) AS lotCount`;

export class SqlCatalogRepository implements CatalogRepository {
  constructor(private readonly db: SqlDatabase) {}

  listCategories(tenantId: string) {
    return this.db.all<CategoryDto>(
      `SELECT c.id, c.code, c.name, c.description, c.status,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status <> 'ARCHIVED') AS productCount
         FROM product_categories c WHERE c.tenant_id = ? AND c.deleted_at IS NULL ORDER BY c.name`,
      [tenantId],
    );
  }

  getCategory(tenantId: string, id: string) {
    return this.db.first<CategoryDto>(
      `SELECT c.id, c.code, c.name, c.description, c.status,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status <> 'ARCHIVED') AS productCount
         FROM product_categories c WHERE c.tenant_id = ? AND c.id = ? AND c.deleted_at IS NULL`,
      [tenantId, id],
    );
  }

  async createCategory(tenantId: string, d: CategoryData) {
    const id = newId();
    await this.db.run("INSERT INTO product_categories (id, tenant_id, code, name, description, status) VALUES (?, ?, ?, ?, ?, ?)", [
      id, tenantId, d.code, d.name, d.description, d.status,
    ]);
    return id;
  }

  async updateCategory(tenantId: string, id: string, d: CategoryData) {
    await this.db.run(`UPDATE product_categories SET code = ?, name = ?, description = ?, status = ?, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [
      d.code, d.name, d.description, d.status, id, tenantId,
    ]);
  }

  async deleteCategory(tenantId: string, id: string) {
    // soft delete; the code is freed for reuse
    await this.db.run(
      `UPDATE product_categories SET deleted_at = ${NOW_SQL}, code = code || '#' || substr(id, 1, 8), status = 'INACTIVE' WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
  }

  private supplierSelect = "id, code, name, contact_name AS contactName, phone, email, address, status";

  listSuppliers(tenantId: string, search?: string) {
    const where = new Where().add("tenant_id = ?", tenantId).add("deleted_at IS NULL");
    if (search) where.add("(name LIKE ? ESCAPE '\\' OR code LIKE ? ESCAPE '\\')", likePattern(search), likePattern(search));
    return this.db.all<SupplierDto>(`SELECT ${this.supplierSelect} FROM suppliers ${where.toSql()} ORDER BY name`, where.params);
  }

  getSupplier(tenantId: string, id: string) {
    return this.db.first<SupplierDto>(`SELECT ${this.supplierSelect} FROM suppliers WHERE tenant_id = ? AND id = ? AND deleted_at IS NULL`, [tenantId, id]);
  }

  async createSupplier(tenantId: string, d: SupplierData) {
    const id = newId();
    await this.db.run(
      "INSERT INTO suppliers (id, tenant_id, code, name, contact_name, phone, email, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, tenantId, d.code, d.name, d.contactName, d.phone, d.email, d.address, d.status],
    );
    return id;
  }

  async updateSupplier(tenantId: string, id: string, d: SupplierData) {
    await this.db.run(
      `UPDATE suppliers SET code = ?, name = ?, contact_name = ?, phone = ?, email = ?, address = ?, status = ?, updated_at = ${NOW_SQL}
        WHERE id = ? AND tenant_id = ?`,
      [d.code, d.name, d.contactName, d.phone, d.email, d.address, d.status, id, tenantId],
    );
  }

  async deleteSupplier(tenantId: string, id: string) {
    await this.db.run(
      `UPDATE suppliers SET deleted_at = ${NOW_SQL}, code = code || '#' || substr(id, 1, 8), status = 'INACTIVE' WHERE id = ? AND tenant_id = ?`,
      [id, tenantId],
    );
  }

  listProducts(tenantId: string, f: ProductFilter) {
    const where = new Where()
      .add("p.tenant_id = ?", tenantId)
      .addIf(f.categoryId, "p.category_id = ?", f.categoryId ?? null);
    if (f.status) where.add("p.status = ?", f.status);
    else where.add("p.status <> 'ARCHIVED'");
    if (f.search) {
      const like = likePattern(f.search);
      where.add("(p.sku LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\')", like, like, like);
    }
    if (f.lowStock) where.add("COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.product_id = p.id), 0) < p.min_stock");
    return paginate<ProductRow>(this.db, PRODUCT_SELECT, `FROM products p LEFT JOIN product_categories c ON c.id = p.category_id ${where.toSql()}`, where.params, "p.sku", f);
  }

  listProductOptions(tenantId: string, search?: string) {
    const where = new Where().add("p.tenant_id = ?", tenantId).add("p.status = 'ACTIVE'");
    if (search) {
      const like = likePattern(search);
      where.add("(p.sku LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR p.barcode = ?)", like, like, search);
    }
    return this.db.all<{ id: string; sku: string; name: string; unit: string; available: number }>(
      `SELECT p.id, p.sku, p.name, p.unit, COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.product_id = p.id), 0) AS available
         FROM products p ${where.toSql()} ORDER BY p.sku LIMIT 50`,
      where.params,
    );
  }

  getProduct(tenantId: string, id: string) {
    return this.db.first<ProductRow>(`SELECT ${PRODUCT_SELECT} FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.tenant_id = ? AND p.id = ?`, [tenantId, id]);
  }

  async createProduct(tenantId: string, d: ProductData) {
    const id = newId();
    await this.db.run(
      `INSERT INTO products (id, tenant_id, category_id, sku, name, barcode, unit, description, min_stock, max_stock, status)
       VALUES (?, ?, (SELECT id FROM product_categories WHERE id = ? AND tenant_id = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, d.categoryId, tenantId, d.sku, d.name, d.barcode, d.unit, d.description, d.minStock, d.maxStock, d.status],
    );
    return id;
  }

  async updateProduct(tenantId: string, id: string, d: ProductData) {
    await this.db.run(
      `UPDATE products SET category_id = (SELECT id FROM product_categories WHERE id = ? AND tenant_id = ?), sku = ?, name = ?, barcode = ?, unit = ?,
              description = ?, min_stock = ?, max_stock = ?, status = ?, updated_at = ${NOW_SQL},
              archived_at = CASE WHEN ? = 'ARCHIVED' THEN COALESCE(archived_at, ${NOW_SQL}) ELSE NULL END
        WHERE id = ? AND tenant_id = ?`,
      [d.categoryId, tenantId, d.sku, d.name, d.barcode, d.unit, d.description, d.minStock, d.maxStock, d.status, d.status, id, tenantId],
    );
  }

  async archiveProduct(tenantId: string, id: string) {
    await this.db.run(`UPDATE products SET status = 'ARCHIVED', archived_at = ${NOW_SQL}, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }

  async restoreProduct(tenantId: string, id: string) {
    await this.db.run(`UPDATE products SET status = 'ACTIVE', archived_at = NULL, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  }

  async setProductImage(tenantId: string, id: string, imageKey: string | null) {
    await this.db.run(`UPDATE products SET image_key = ?, updated_at = ${NOW_SQL} WHERE id = ? AND tenant_id = ?`, [imageKey, id, tenantId]);
  }
}
