// Shared, framework-free constants used by both the Worker and the SPA.

export const ROLES = ["ADMIN", "WAREHOUSE_MANAGER", "WAREHOUSE_STAFF"] as const;
export type RoleCode = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "warehouse.view",
  "warehouse.manage",
  "product.view",
  "product.manage",
  "inventory.view",
  "lot.manage",
  "receipt.create",
  "receipt.confirm",
  "issue.create",
  "transfer.create",
  "transfer.confirm",
  "stocktaking.count",
  "stocktaking.approve",
  "report.view",
  "user.manage",
  "settings.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "warehouse.view",
  "product.view",
  "inventory.view",
  "receipt.create",
  "receipt.confirm",
  "issue.create",
  "stocktaking.count",
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...STAFF_PERMISSIONS,
  "warehouse.manage",
  "product.manage",
  "lot.manage",
  "transfer.create",
  "transfer.confirm",
  "stocktaking.approve",
  "report.view",
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<RoleCode, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  WAREHOUSE_MANAGER: MANAGER_PERMISSIONS,
  WAREHOUSE_STAFF: STAFF_PERMISSIONS,
};

export function permissionsForRoles(roles: readonly RoleCode[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  return [...set];
}

export const ACTIVE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const LOT_STATUSES = ["AVAILABLE", "QUARANTINE", "BLOCKED"] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const ZONE_TYPES = ["GENERAL", "COLD", "DRY", "HAZARD", "BULK"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export const DOCUMENT_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const STOCKTAKING_STATUSES = ["COUNTING", "SUBMITTED", "APPROVED", "CANCELLED"] as const;
export type StocktakingStatus = (typeof STOCKTAKING_STATUSES)[number];

export const ISSUE_REASONS = ["SALE", "INTERNAL_USE", "RETURN_TO_SUPPLIER", "DISPOSAL", "OTHER"] as const;
export type IssueReason = (typeof ISSUE_REASONS)[number];

export const TRANSACTION_TYPES = ["RECEIPT", "ISSUE", "TRANSFER_OUT", "TRANSFER_IN", "ADJUSTMENT"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Expiry buckets. Days remaining = expiration_date - today (Vietnam business date). */
export const EXPIRY_STATUSES = ["EXPIRED", "CRITICAL", "WARNING", "NOTICE", "SAFE", "NO_EXPIRY"] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export const EXPIRY_THRESHOLDS = {
  /** 1–7 days */
  critical: 7,
  /** 8–30 days */
  warning: 30,
  /** 31–60 days */
  notice: 60,
} as const;

/** Bin utilisation colour bands. */
export const CAPACITY_THRESHOLDS = { near: 0.8, full: 1 } as const;
export const CAPACITY_STATUSES = ["AVAILABLE", "NEAR_CAPACITY", "FULL", "INACTIVE"] as const;
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];

/** Lots untouched for this many days count as slow-moving ("tồn lâu ngày"). */
export const SLOW_MOVING_DAYS = 90;

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 200;

/** Machine-readable error codes; the SPA translates them (locales/<lang>/translation.json > errors). */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "DUPLICATE",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DISABLED",
  "RATE_LIMITED",
  "CSRF_INVALID",
  "INSUFFICIENT_STOCK",
  "STOCK_CHANGED",
  "BIN_CAPACITY_EXCEEDED",
  "BIN_INACTIVE",
  "INVALID_STATUS_TRANSITION",
  "LOT_MISMATCH",
  "LOT_NOT_AVAILABLE",
  "IN_USE",
  "ZONE_OVERLAP",
  "STORAGE_UNAVAILABLE",
  "DEMO_DISABLED",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
