import { Category, Account, Transaction, Debt, Target as FinancialTarget, Reminder, Allocation } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Makanan', icon: 'Utensils', color: '#FF9500', type: 'expense', budget: 1500000 },
  { id: '2', name: 'Transportasi', icon: 'Car', color: '#007AFF', type: 'expense', budget: 800000 },
  { id: '3', name: 'Tagihan', icon: 'CreditCard', color: '#FF3B30', type: 'expense', budget: 1200000 },
  { id: '4', name: 'Hiburan', icon: 'Gamepad2', color: '#AF52DE', type: 'expense', budget: 600000 },
  { id: '5', name: 'Pendidikan', icon: 'GraduationCap', color: '#34C759', type: 'expense', budget: 1000000 },
  { id: '9', name: 'Tabungan', icon: 'PiggyBank', color: '#30B0C7', type: 'expense', budget: 2000000 },
  { id: '6', name: 'Gaji', icon: 'Briefcase', color: '#34C759', type: 'income' },
  { id: '7', name: 'Bonus', icon: 'Gift', color: '#FFCC00', type: 'income' },
  { id: '8', name: 'Investasi', icon: 'Landmark', color: '#5856D6', type: 'income' },
  { id: '10', name: 'Pengembalian Dana', icon: 'Tag', color: '#30B0C7', type: 'income' },
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc1', name: 'Uang tunai', balance: 0, type: 'cash' },
  { id: 'acc2', name: 'Bank Jatim', balance: 0, type: 'bank' },
  { id: 'acc4', name: 'Bank Jatim Syariah', balance: 0, type: 'bank' },
  { id: 'acc5', name: 'BSI', balance: 0, type: 'bank' },
  { id: 'acc3', name: 'DANA', balance: 0, type: 'e-wallet' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_TARGETS: FinancialTarget[] = [];

export const INITIAL_ALLOCATIONS: Allocation[] = [];
