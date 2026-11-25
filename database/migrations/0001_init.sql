-- =============================================================================
-- WMS initial schema (Cloudflare D1 / SQLite)
-- Conventions: TEXT ids (UUID / deterministic seed ids), ISO-8601 UTC timestamps,
-- business dates as 'YYYY-MM-DD' (Asia/Ho_Chi_Minh), integer quantities.
-- Every tenant-owned table carries tenant_id; the backend always filters by it.
-- =============================================================================

-- ---------- Tenancy & identity ----------------------------------------------
CREATE TABLE tenants (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  settings    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE roles (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE CHECK (code IN ('ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF')),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name      TEXT NOT NULL,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
);
CREATE INDEX idx_users_tenant ON users (tenant_id);

CREATE TABLE user_roles (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     TEXT NOT NULL REFERENCES roles(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, role_id)
);

-- Server-side sessions. id = HMAC-SHA256(token, SESSION_SECRET); the raw token only lives in the cookie.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  csrf_token    TEXT NOT NULL,
  ip_address    TEXT,
  user_agent    TEXT,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- Login rate limiting (per IP and per email).
CREATE TABLE login_attempts (
  attempt_key   TEXT PRIMARY KEY,
  attempts      INTEGER NOT NULL DEFAULT 0,
  window_start  TEXT NOT NULL,
  locked_until  TEXT
);

-- ---------- Warehouse structure: Warehouse > Zone > Rack > Level > Bin --------
CREATE TABLE warehouses (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  address     TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at  TEXT,
  UNIQUE (tenant_id, code)
);

CREATE TABLE warehouse_zones (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id  TEXT NOT NULL REFERENCES warehouses(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  zone_type     TEXT NOT NULL DEFAULT 'GENERAL' CHECK (zone_type IN ('GENERAL', 'COLD', 'DRY', 'HAZARD', 'BULK')),
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  -- 2D map layout on a 100 x 60 grid
  map_x         INTEGER NOT NULL DEFAULT 0,
  map_y         INTEGER NOT NULL DEFAULT 0,
  map_width     INTEGER NOT NULL DEFAULT 20,
  map_height    INTEGER NOT NULL DEFAULT 20,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT,
  UNIQUE (warehouse_id, code)
);
CREATE INDEX idx_zones_tenant ON warehouse_zones (tenant_id);

CREATE TABLE warehouse_racks (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  zone_id     TEXT NOT NULL REFERENCES warehouse_zones(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at  TEXT,
  UNIQUE (zone_id, code)
);
CREATE INDEX idx_racks_tenant_zone ON warehouse_racks (tenant_id, zone_id);

CREATE TABLE warehouse_levels (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  rack_id       TEXT NOT NULL REFERENCES warehouse_racks(id),
  code          TEXT NOT NULL,
  level_number  INTEGER NOT NULL CHECK (level_number > 0),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (rack_id, code)
);
CREATE INDEX idx_levels_tenant_rack ON warehouse_levels (tenant_id, rack_id);

CREATE TABLE warehouse_bins (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id   TEXT NOT NULL REFERENCES warehouses(id),
  zone_id        TEXT NOT NULL REFERENCES warehouse_zones(id),
  rack_id        TEXT NOT NULL REFERENCES warehouse_racks(id),
  level_id       TEXT NOT NULL REFERENCES warehouse_levels(id),
  code           TEXT NOT NULL,
  location_code  TEXT NOT NULL,
  capacity       INTEGER NOT NULL CHECK (capacity >= 0),
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (level_id, code),
  UNIQUE (tenant_id, location_code)
);
CREATE INDEX idx_bins_tenant_zone ON warehouse_bins (tenant_id, zone_id);
CREATE INDEX idx_bins_tenant_rack ON warehouse_bins (tenant_id, rack_id);

-- ---------- Products --------------------------------------------------------
CREATE TABLE product_categories (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at  TEXT,
  UNIQUE (tenant_id, code)
);

CREATE TABLE products (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  category_id  TEXT REFERENCES product_categories(id),
  sku          TEXT NOT NULL,
  name         TEXT NOT NULL,
  barcode      TEXT,
  unit         TEXT NOT NULL,
  description  TEXT,
  image_key    TEXT,
  min_stock    INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  max_stock    INTEGER CHECK (max_stock IS NULL OR max_stock >= min_stock),
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at  TEXT,
  UNIQUE (tenant_id, sku)
);
CREATE INDEX idx_products_tenant_category ON products (tenant_id, category_id);
CREATE INDEX idx_products_tenant_barcode ON products (tenant_id, barcode);

CREATE TABLE suppliers (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at    TEXT,
  UNIQUE (tenant_id, code)
);

-- ---------- Lots & balances (inventory key = product + lot + bin) -----------
CREATE TABLE inventory_lots (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  product_id          TEXT NOT NULL REFERENCES products(id),
  supplier_id         TEXT REFERENCES suppliers(id),
  lot_number          TEXT NOT NULL,
  manufacturing_date  TEXT,
  expiration_date     TEXT,
  received_date       TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'QUARANTINE', 'BLOCKED')),
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, product_id, lot_number),
  CHECK (expiration_date IS NULL OR manufacturing_date IS NULL OR expiration_date >= manufacturing_date)
);
CREATE INDEX idx_lots_tenant_product_exp ON inventory_lots (tenant_id, product_id, expiration_date);
CREATE INDEX idx_lots_tenant_exp ON inventory_lots (tenant_id, expiration_date);

-- quantity >= 0 is the last line of defence against oversell / negative stock:
-- any batch that would push a balance below zero is rolled back entirely.
CREATE TABLE inventory_balances (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  product_id  TEXT NOT NULL REFERENCES products(id),
  lot_id      TEXT NOT NULL REFERENCES inventory_lots(id),
  bin_id      TEXT NOT NULL REFERENCES warehouse_bins(id),
  quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (lot_id, bin_id)
);
CREATE INDEX idx_balances_tenant_product ON inventory_balances (tenant_id, product_id);
CREATE INDEX idx_balances_bin ON inventory_balances (bin_id);

-- ---------- Stock receipts (Nhập kho) ----------------------------------------
CREATE TABLE stock_receipts (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id    TEXT NOT NULL REFERENCES warehouses(id),
  receipt_number  TEXT NOT NULL,
  supplier_id     TEXT REFERENCES suppliers(id),
  receipt_date    TEXT NOT NULL,
  reference_no    TEXT,
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  confirmed_by    TEXT REFERENCES users(id),
  confirmed_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, receipt_number)
);
CREATE INDEX idx_receipts_tenant_date ON stock_receipts (tenant_id, receipt_date);

CREATE TABLE stock_receipt_items (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  receipt_id          TEXT NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL REFERENCES products(id),
  lot_id              TEXT REFERENCES inventory_lots(id),
  lot_number          TEXT NOT NULL,
  manufacturing_date  TEXT,
  expiration_date     TEXT,
  bin_id              TEXT NOT NULL REFERENCES warehouse_bins(id),
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_receipt_items_receipt ON stock_receipt_items (receipt_id);

-- ---------- Stock issues (Xuất kho, FEFO) ------------------------------------
CREATE TABLE stock_issues (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id  TEXT NOT NULL REFERENCES warehouses(id),
  issue_number  TEXT NOT NULL,
  request_key   TEXT NOT NULL,
  issue_date    TEXT NOT NULL,
  recipient     TEXT,
  reason        TEXT NOT NULL DEFAULT 'SALE' CHECK (reason IN ('SALE', 'INTERNAL_USE', 'RETURN_TO_SUPPLIER', 'DISPOSAL', 'OTHER')),
  status        TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  notes         TEXT,
  created_by    TEXT REFERENCES users(id),
  confirmed_by  TEXT REFERENCES users(id),
  confirmed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, issue_number),
  -- idempotency key: the same confirmation can never be posted twice
  UNIQUE (tenant_id, request_key)
);
CREATE INDEX idx_issues_tenant_date ON stock_issues (tenant_id, issue_date);

CREATE TABLE stock_issue_items (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  issue_id         TEXT NOT NULL REFERENCES stock_issues(id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products(id),
  lot_id           TEXT NOT NULL REFERENCES inventory_lots(id),
  bin_id           TEXT NOT NULL REFERENCES warehouse_bins(id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  expiration_date  TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_issue_items_issue ON stock_issue_items (issue_id);

-- ---------- Stock transfers (Điều chuyển) ------------------------------------
CREATE TABLE stock_transfers (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id     TEXT NOT NULL REFERENCES warehouses(id),
  transfer_number  TEXT NOT NULL,
  transfer_date    TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  reason           TEXT,
  notes            TEXT,
  created_by       TEXT REFERENCES users(id),
  confirmed_by     TEXT REFERENCES users(id),
  confirmed_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, transfer_number)
);

CREATE TABLE stock_transfer_items (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  transfer_id  TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products(id),
  lot_id       TEXT NOT NULL REFERENCES inventory_lots(id),
  from_bin_id  TEXT NOT NULL REFERENCES warehouse_bins(id),
  to_bin_id    TEXT NOT NULL REFERENCES warehouse_bins(id),
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (from_bin_id <> to_bin_id)
);
CREATE INDEX idx_transfer_items_transfer ON stock_transfer_items (transfer_id);

-- ---------- Stocktaking (Kiểm kê) --------------------------------------------
CREATE TABLE stocktaking_sessions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  warehouse_id    TEXT NOT NULL REFERENCES warehouses(id),
  session_number  TEXT NOT NULL,
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('ALL', 'ZONE', 'RACK')),
  scope_ids       TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'COUNTING' CHECK (status IN ('COUNTING', 'SUBMITTED', 'APPROVED', 'CANCELLED')),
  notes           TEXT,
  created_by      TEXT REFERENCES users(id),
  submitted_by    TEXT REFERENCES users(id),
  submitted_at    TEXT,
  approved_by     TEXT REFERENCES users(id),
  approved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, session_number)
);

CREATE TABLE stocktaking_items (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  session_id        TEXT NOT NULL REFERENCES stocktaking_sessions(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  lot_id            TEXT NOT NULL REFERENCES inventory_lots(id),
  bin_id            TEXT NOT NULL REFERENCES warehouse_bins(id),
  system_quantity   INTEGER NOT NULL CHECK (system_quantity >= 0),
  counted_quantity  INTEGER CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  counted_by        TEXT REFERENCES users(id),
  counted_at        TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (session_id, lot_id, bin_id)
);
CREATE INDEX idx_stocktaking_items_session ON stocktaking_items (session_id);

-- ---------- Ledger & audit ---------------------------------------------------
CREATE TABLE inventory_transactions (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id),
  transaction_type   TEXT NOT NULL CHECK (transaction_type IN ('RECEIPT', 'ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT')),
  product_id         TEXT NOT NULL REFERENCES products(id),
  lot_id             TEXT NOT NULL REFERENCES inventory_lots(id),
  bin_id             TEXT NOT NULL REFERENCES warehouse_bins(id),
  quantity_change    INTEGER NOT NULL CHECK (quantity_change <> 0),
  balance_after      INTEGER,
  reference_type     TEXT NOT NULL CHECK (reference_type IN ('STOCK_RECEIPT', 'STOCK_ISSUE', 'STOCK_TRANSFER', 'STOCKTAKING')),
  reference_id       TEXT NOT NULL,
  reference_item_id  TEXT NOT NULL,
  transaction_date   TEXT NOT NULL,
  created_by         TEXT REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- a document line can be posted to the ledger only once per movement type
  UNIQUE (reference_item_id, transaction_type)
);
CREATE INDEX idx_txn_tenant_date ON inventory_transactions (tenant_id, transaction_date);
CREATE INDEX idx_txn_tenant_product ON inventory_transactions (tenant_id, product_id, created_at);
CREATE INDEX idx_txn_lot ON inventory_transactions (lot_id);

CREATE TABLE audit_logs (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT REFERENCES tenants(id),
  user_id      TEXT REFERENCES users(id),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  details      TEXT,
  ip_address   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_tenant_created ON audit_logs (tenant_id, created_at);

-- ---------- Integrity triggers -----------------------------------------------
-- Bin capacity: abort the whole batch when a bin would exceed its capacity.
CREATE TRIGGER trg_balances_capacity_insert
AFTER INSERT ON inventory_balances
BEGIN
  SELECT RAISE(ABORT, 'BIN_CAPACITY_EXCEEDED')
  WHERE (SELECT COALESCE(SUM(quantity), 0) FROM inventory_balances WHERE bin_id = NEW.bin_id)
      > (SELECT capacity FROM warehouse_bins WHERE id = NEW.bin_id);
  SELECT RAISE(ABORT, 'BIN_INACTIVE')
  WHERE NEW.quantity > 0 AND (SELECT status FROM warehouse_bins WHERE id = NEW.bin_id) <> 'ACTIVE';
END;

CREATE TRIGGER trg_balances_capacity_update
AFTER UPDATE OF quantity ON inventory_balances
WHEN NEW.quantity > OLD.quantity
BEGIN
  SELECT RAISE(ABORT, 'BIN_CAPACITY_EXCEEDED')
  WHERE (SELECT COALESCE(SUM(quantity), 0) FROM inventory_balances WHERE bin_id = NEW.bin_id)
      > (SELECT capacity FROM warehouse_bins WHERE id = NEW.bin_id);
  SELECT RAISE(ABORT, 'BIN_INACTIVE')
  WHERE (SELECT status FROM warehouse_bins WHERE id = NEW.bin_id) <> 'ACTIVE';
END;

-- Document state machines: a finalised document can never be confirmed twice.
CREATE TRIGGER trg_receipts_status
BEFORE UPDATE OF status ON stock_receipts
WHEN OLD.status <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'INVALID_STATUS_TRANSITION');
END;

CREATE TRIGGER trg_transfers_status
BEFORE UPDATE OF status ON stock_transfers
WHEN OLD.status <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'INVALID_STATUS_TRANSITION');
END;

CREATE TRIGGER trg_stocktaking_status
BEFORE UPDATE OF status ON stocktaking_sessions
WHEN OLD.status IN ('APPROVED', 'CANCELLED')
  OR (NEW.status = 'APPROVED' AND OLD.status <> 'SUBMITTED')
BEGIN
  SELECT RAISE(ABORT, 'INVALID_STATUS_TRANSITION');
END;

CREATE TRIGGER trg_issues_status
BEFORE UPDATE OF status ON stock_issues
WHEN OLD.status <> 'CONFIRMED'
BEGIN
  SELECT RAISE(ABORT, 'INVALID_STATUS_TRANSITION');
END;

-- ---------- Reference data ---------------------------------------------------
INSERT INTO roles (id, code, name, description) VALUES
  ('role_admin', 'ADMIN', 'Quản trị viên', 'Toàn quyền hệ thống'),
  ('role_manager', 'WAREHOUSE_MANAGER', 'Quản lý kho', 'Quản lý hàng hóa, tồn kho, duyệt nghiệp vụ'),
  ('role_staff', 'WAREHOUSE_STAFF', 'Nhân viên kho', 'Nhập, xuất, kiểm kê');
