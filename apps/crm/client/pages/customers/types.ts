export type CustomerStatus = 'lead' | 'followingUp' | 'won';
export interface Customer {
  id: string;
  title: string;
  contact: string;
  description: string;
  status: CustomerStatus;
  salesOwnerId: string | null;
  salesOwnerName: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: { edit: boolean; progress: boolean; delete: boolean };
}
export interface CustomerList {
  data: Customer[];
  meta: { page: number; pageSize: number; total: number };
}
export const statuses: CustomerStatus[] = ['lead', 'followingUp', 'won'];
