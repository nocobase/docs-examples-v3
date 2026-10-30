export const deviceCategories = [
  'laptop',
  'desktop',
  'monitor',
  'phone',
  'accessory',
] as const;
export const deviceStatuses = [
  'inStock',
  'inUse',
  'inRepair',
  'retired',
] as const;
export type DeviceCategory = (typeof deviceCategories)[number];
export type DeviceStatus = (typeof deviceStatuses)[number];

export interface Device {
  id: string;
  assetTag: string;
  name: string;
  category: DeviceCategory;
  serialNumber: string | null;
  status: DeviceStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  location: string;
  purchaseDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  permissions: { edit: boolean; delete: boolean };
}

export interface DeviceList {
  data: Device[];
  meta: { page: number; pageSize: number; total: number };
}
