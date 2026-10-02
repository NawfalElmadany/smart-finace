export type TransactionType = 'income' | 'expense';
export type CategoryType = TransactionType | 'both';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  budget?: number;
  isCustom?: boolean;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: 'cash' | 'bank' | 'e-wallet';
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  date: string;
  note: string;
  allocationId?: string;
  allocationNameSnapshot?: string;
}

export interface Debt {
  id: string;
  title: string;
  amount: number;
  type: 'debt' | 'receivable';
  dueDate: string;
  isPaid: boolean;
}

export interface Target {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}

export interface Allocation {
  id: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  alertThreshold: number;
  note?: string;
  isCustom?: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  date: string;
  isCompleted: boolean;
}
