// API contract types (camelCase). Independent of hosting and database.
import type {
  ActiveStatus,
  CapacityStatus,
  DocumentStatus,
  ErrorCode,
  ExpiryStatus,
  IssueReason,
  LotStatus,
  Permission,
  ProductStatus,
  RoleCode,
  StocktakingStatus,
  TransactionType,
  ZoneType,
} from "../constants";

export interface ApiSuccess<T> {
  data: T;
  meta?: PageMeta;
}
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown };
}
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantName: string;
  roles: RoleCode[];
  permissions: Permission[];
}
export interface AuthPayload {
  user: SessionUser;
  csrfToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: ActiveStatus;
  roles: RoleCode[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface WarehouseDto {
  id: string;
  code: string;
  name: string;
  address: string | null;
  status: ActiveStatus;
}

export interface CapacityInfo {
  capacity: number;
  used: number;
  utilization: number;
  capacityStatus: CapacityStatus;
}

export interface ZoneDto extends CapacityInfo {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  zoneType: ZoneType;
  description: string | null;
  status: ActiveStatus;
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  rackCount: number;
  binCount: number;
}

export interface RackDto extends CapacityInfo {
  id: string;
  zoneId: string;
  zoneCode: string;
  code: string;
  name: string;
  status: ActiveStatus;
  levelCount: number;
  binCount: number;
}

export interface LevelDto extends CapacityInfo {
  id: string;
  rackId: string;
  code: string;
  levelNumber: number;
  status: ActiveStatus;
  bins: BinDto[];
}

export interface BinDto extends CapacityInfo {
  id: string;
  zoneId: string;
  rackId: string;
  levelId: string;
  code: string;
  locationCode: string;
  status: ActiveStatus;
  lotCount: number;
  productCount: number;
}

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ActiveStatus;
  productCount: number;
}

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: ActiveStatus;
}

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  description: string | null;
  imageUrl: string | null;
  minStock: number;
  maxStock: number | null;
  status: ProductStatus;
  totalQuantity: number;
  lotCount: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LotDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  supplierId: string | null;
  supplierName: string | null;
  lotNumber: string;
  manufacturingDate: string | null;
  expirationDate: string | null;
  receivedDate: string;
  status: LotStatus;
  notes: string | null;
  quantity: number;
  locationCount: number;
  locations: string[];
  daysToExpiry: number | null;
  expiryStatus: ExpiryStatus;
  shelfLifePercent: number | null;
}

/** One inventory position: product + lot + bin. */
export interface InventoryPositionDto {
  balanceId: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  categoryName: string | null;
  lotId: string;
  lotNumber: string;
  lotStatus: LotStatus;
  manufacturingDate: string | null;
  expirationDate: string | null;
  receivedDate: string;
  binId: string;
  locationCode: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  quantity: number;
  daysToExpiry: number | null;
  expiryStatus: ExpiryStatus;
}

export interface InventoryTransactionDto {
  id: string;
  transactionType: TransactionType;
  productId: string;
  productSku: string;
  productName: string;
  lotNumber: string;
  locationCode: string;
  quantityChange: number;
  balanceAfter: number | null;
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  transactionDate: string;
  createdByName: string | null;
  createdAt: string;
}

export interface ReceiptItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  lotId: string | null;
  lotNumber: string;
  manufacturingDate: string | null;
  expirationDate: string | null;
  binId: string;
  locationCode: string;
  quantity: number;
}
export interface ReceiptDto {
  id: string;
  receiptNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  receiptDate: string;
  referenceNo: string | null;
  status: DocumentStatus;
  notes: string | null;
  totalQuantity: number;
  itemCount: number;
  createdByName: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items?: ReceiptItemDto[];
}

export interface FefoAllocationDto {
  balanceId: string;
  lotId: string;
  lotNumber: string;
  binId: string;
  locationCode: string;
  expirationDate: string | null;
  daysToExpiry: number | null;
  expiryStatus: ExpiryStatus;
  availableQuantity: number;
  allocatedQuantity: number;
}
export interface FefoLinePreviewDto {
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  shortageQuantity: number;
  excluded: { expired: number; quarantine: number; blocked: number };
  allocations: FefoAllocationDto[];
}
export interface FefoPreviewDto {
  lines: FefoLinePreviewDto[];
  fulfillable: boolean;
  fingerprint: string;
  businessDate: string;
}

export interface IssueItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  binId: string;
  locationCode: string;
  expirationDate: string | null;
  quantity: number;
}
export interface IssueDto {
  id: string;
  issueNumber: string;
  issueDate: string;
  recipient: string | null;
  reason: IssueReason;
  status: "CONFIRMED" | "CANCELLED";
  notes: string | null;
  totalQuantity: number;
  itemCount: number;
  createdByName: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items?: IssueItemDto[];
}

export interface TransferItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  fromBinId: string;
  fromLocationCode: string;
  toBinId: string;
  toLocationCode: string;
  quantity: number;
}
export interface TransferDto {
  id: string;
  transferNumber: string;
  transferDate: string;
  status: DocumentStatus;
  reason: string | null;
  notes: string | null;
  totalQuantity: number;
  itemCount: number;
  createdByName: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items?: TransferItemDto[];
}

export interface StocktakingItemDto {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  unit: string;
  lotId: string;
  lotNumber: string;
  expirationDate: string | null;
  binId: string;
  locationCode: string;
  systemQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
  countedByName: string | null;
  countedAt: string | null;
  notes: string | null;
}
export interface StocktakingDto {
  id: string;
  sessionNumber: string;
  scopeType: "ALL" | "ZONE" | "RACK";
  scopeIds: string[];
  scopeLabel: string;
  status: StocktakingStatus;
  notes: string | null;
  itemCount: number;
  countedCount: number;
  discrepancyCount: number;
  createdByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  items?: StocktakingItemDto[];
}

export interface DashboardDto {
  businessDate: string;
  totals: {
    quantity: number;
    skuCount: number;
    categoryCount: number;
    lotCount: number;
    binCount: number;
    utilization: number;
    expiringSoonQuantity: number;
    expiringSoonLots: number;
    expiredQuantity: number;
    expiredLots: number;
    lowStockProducts: number;
  };
  byCategory: { name: string; quantity: number }[];
  byZone: { code: string; name: string; quantity: number; capacity: number; utilization: number }[];
  movements: { date: string; inbound: number; outbound: number }[];
  expiryBreakdown: { status: ExpiryStatus; quantity: number; lots: number }[];
  binUtilization: { status: CapacityStatus; count: number }[];
  alerts: InventoryPositionDto[];
  lowStock: { id: string; sku: string; name: string; unit: string; quantity: number; minStock: number }[];
  recentTransactions: InventoryTransactionDto[];
}

export interface LocationSearchResultDto {
  binId: string;
  locationCode: string;
  zoneId: string;
  rackId: string;
  levelId: string;
  productSku: string;
  productName: string;
  lotNumber: string;
  quantity: number;
}

export interface BinDetailDto extends BinDto {
  zoneCode: string;
  zoneName: string;
  rackCode: string;
  levelCode: string;
  positions: InventoryPositionDto[];
}

export interface TenantSettingsDto {
  companyName: string;
  slowMovingDays: number;
  nearCapacityPercent: number;
  demoMode: boolean;
  appEnv: string;
  databaseProvider: string;
  storageProvider: string;
  storageAvailable: boolean;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  userName: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface ReportColumn {
  key: string;
  /** i18n key under reports.columns */
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "status";
}
export interface ReportDto {
  type: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  summary?: Record<string, number>;
}
