import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { 
  Home, 
  Plus, 
  BarChart2, 
  User, 
  Wallet, 
  ChevronRight,
  Bell,
  Settings,
  Target,
  FileText,
  ShieldCheck,
  Search,
  CreditCard,
  Utensils,
  Car,
  Gamepad2,
  GraduationCap,
  Briefcase,
  Gift,
  Landmark,
  PiggyBank,
  ShoppingBag,
  House,
  HeartPulse,
  Tag,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
  Lock,
  LogOut
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  Transaction, 
  Category, 
  Account, 
  Allocation,
  CategoryType,
  TransactionType,
  Target as FinancialTarget
} from './types';
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, INITIAL_TRANSACTIONS, INITIAL_TARGETS, INITIAL_ALLOCATIONS } from './constants';
import { getDeviceId, loadSnapshotFromCloud, saveSnapshotToCloud } from './lib/cloudState';
import { isSupabaseConfigured } from './lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORY_ICON_MAP = {
  Utensils,
  Car,
  CreditCard,
  Gamepad2,
  GraduationCap,
  Briefcase,
  Gift,
  Landmark,
  PiggyBank,
  ShoppingBag,
  House,
  HeartPulse,
  Tag,
  FileText,
} as const satisfies Record<string, LucideIcon>;

type CategoryIconName = keyof typeof CATEGORY_ICON_MAP;

const CATEGORY_ICON_OPTIONS: Array<{ value: CategoryIconName; label: string }> = [
  { value: 'Utensils', label: 'Makanan' },
  { value: 'Car', label: 'Transport' },
  { value: 'CreditCard', label: 'Tagihan' },
  { value: 'ShoppingBag', label: 'Belanja' },
  { value: 'Gamepad2', label: 'Hiburan' },
  { value: 'HeartPulse', label: 'Sehat' },
  { value: 'House', label: 'Rumah' },
  { value: 'PiggyBank', label: 'Tabungan' },
  { value: 'Briefcase', label: 'Kerja' },
  { value: 'Gift', label: 'Bonus' },
  { value: 'Landmark', label: 'Investasi' },
  { value: 'Tag', label: 'Lainnya' },
];

const CATEGORY_COLOR_OPTIONS = [
  '#007AFF',
  '#34C759',
  '#FF9500',
  '#FF3B30',
  '#AF52DE',
  '#5856D6',
  '#30B0C7',
  '#FF2D55',
] as const;

const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  expense: 'Pengeluaran',
  income: 'Pemasukan',
  both: 'Keduanya',
};

const TARGET_GRADIENTS = [
  'from-zinc-800 via-zinc-700 to-zinc-900',
  'from-orange-500 via-amber-400 to-yellow-300',
  'from-cyan-600 via-sky-500 to-blue-400',
  'from-emerald-500 via-green-400 to-lime-300',
] as const;

const LOCAL_STATE_UPDATED_AT_KEY = 'sf_local_updated_at';
const LOCAL_TRANSACTIONS_KEY = 'sf_transactions';
const LOCAL_ACCOUNTS_KEY = 'sf_accounts';
const LOCAL_CATEGORIES_KEY = 'sf_categories';
const LOCAL_TARGETS_KEY = 'sf_targets';
const LOCAL_ALLOCATIONS_KEY = 'sf_allocations';
const LOCAL_SHOW_BALANCES_KEY = 'sf_show_balances';

const scopedStorageKey = (baseKey: string, userId: string | null) =>
  userId ? `${baseKey}:${userId}` : baseKey;

const parseStoredValue = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeStoredCategories = (storedCategories: Category[]) => {
  const normalized = storedCategories.map((category) => {
    const fallback = DEFAULT_CATEGORIES.find(
      (defaultCategory) =>
        defaultCategory.id === category.id ||
        defaultCategory.name.toLowerCase() === category.name.toLowerCase()
    );

    return {
      ...category,
      icon: (category.icon as CategoryIconName) || fallback?.icon || 'FileText',
      color: category.color || fallback?.color || '#8E8E93',
      type: category.type || fallback?.type || 'expense',
    };
  });

  DEFAULT_CATEGORIES.forEach((defaultCategory) => {
    const exists = normalized.some(
      (category) =>
        category.id === defaultCategory.id ||
        category.name.toLowerCase() === defaultCategory.name.toLowerCase()
    );

    if (!exists) {
      normalized.push(defaultCategory);
    }
  });

  return normalized;
};

const normalizeStoredAccounts = (storedAccounts: Account[]) => {
  const normalizedDefaults = DEFAULT_ACCOUNTS.map((defaultAccount) => {
    const savedAccount = storedAccounts.find((account) => account.id === defaultAccount.id);

    if (!savedAccount) {
      return defaultAccount;
    }

    return {
      ...defaultAccount,
      balance: savedAccount.balance,
    };
  });

  const extraAccounts = storedAccounts.filter(
    (account) => !DEFAULT_ACCOUNTS.some((defaultAccount) => defaultAccount.id === account.id)
  );

  return [...normalizedDefaults, ...extraAccounts];
};

const normalizeStoredAllocations = (storedAllocations: Allocation[]) => {
  const normalized: Allocation[] = storedAllocations.map((allocation) => {
    const fallback = INITIAL_ALLOCATIONS.find(
      (defaultAllocation) =>
        defaultAllocation.id === allocation.id ||
        defaultAllocation.name.toLowerCase() === allocation.name.toLowerCase()
    );

    return {
      ...allocation,
      icon: (allocation.icon as CategoryIconName) || fallback?.icon || 'PiggyBank',
      color: allocation.color || fallback?.color || '#007AFF',
      targetAmount: allocation.targetAmount || fallback?.targetAmount || 0,
      currentAmount: allocation.currentAmount ?? fallback?.currentAmount ?? 0,
      alertThreshold: allocation.alertThreshold || fallback?.alertThreshold || 20,
      isCustom: allocation.isCustom ?? !fallback,
    };
  });

  INITIAL_ALLOCATIONS.forEach((defaultAllocation) => {
    const exists = normalized.some(
      (allocation) =>
        allocation.id === defaultAllocation.id ||
        allocation.name.toLowerCase() === defaultAllocation.name.toLowerCase()
    );

    if (!exists) {
      normalized.push({ ...defaultAllocation, isCustom: false });
    }
  });

  return normalized;
};

const padNumber = (value: number) => value.toString().padStart(2, '0');

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const toMonthKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;

const isSameMonthValue = (dateValue: string, monthKey: string) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}` === monthKey;
};

const isDateWithinRange = (dateValue: string, startDateKey: string, endDateKey: string) => {
  if (!startDateKey || !endDateKey) return false;

  const currentDateKey = toDateKey(new Date(dateValue));
  const [rangeStart, rangeEnd] =
    startDateKey <= endDateKey ? [startDateKey, endDateKey] : [endDateKey, startDateKey];

  return currentDateKey >= rangeStart && currentDateKey <= rangeEnd;
};

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// --- Icons Helper ---
const CategoryIcon = ({ icon, size = 20, className = "" }: { icon?: string, size?: number, className?: string }) => {
  const Icon = CATEGORY_ICON_MAP[(icon as CategoryIconName) || 'FileText'] || FileText;
  return <Icon size={size} className={className} />;
};

// --- Components ---

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'transactions', icon: CreditCard, label: 'Transaksi' },
    { id: 'reports', icon: BarChart2, label: 'Laporan' },
    { id: 'profile', icon: User, label: 'Profil' },
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-50 max-w-md mx-auto px-4">
      <div className="glass-effect h-[74px] rounded-[26px] px-2.5 flex items-center justify-between">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all duration-300",
              activeTab === tab.id
                ? "text-[#1C74FF] bg-white/75 shadow-[0_8px_20px_rgba(18,82,185,0.16)]"
                : "text-[#7B8393]"
            )}
          >
            <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const PinScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const [pin, setPin] = useState('');
  
  const handleNumber = (n: string) => {
    if (pin.length < 4) {
      const newPin = pin + n;
      setPin(newPin);
      if (newPin === '1234') {
        setTimeout(onUnlock, 300);
      } else if (newPin.length === 4) {
        setTimeout(() => setPin(''), 500);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
          <Lock className="text-[var(--color-ios-blue)]" size={32} />
        </div>
        <h2 className="text-xl font-bold">Masukkan PIN</h2>
        <p className="text-sm text-[var(--color-ios-gray)]">Gunakan PIN 1234 untuk masuk</p>
      </div>

      <div className="flex space-x-4">
        {[0, 1, 2, 3].map((i) => (
          <div 
            key={i} 
            className={cn(
              "w-4 h-4 rounded-full border-2 border-[var(--color-ios-blue)] transition-all duration-200",
              pin.length > i ? "bg-[var(--color-ios-blue)] scale-110" : "bg-transparent"
            )} 
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-8">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'X'].map((n, i) => (
          <button
            key={i}
            onClick={() => n === 'X' ? setPin('') : n && handleNumber(n)}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold active:bg-gray-100 transition-colors",
              !n && "invisible"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// --- Main App ---

interface AppProps {
  userId?: string | null;
  onSignOut?: () => void;
}

export default function App({ userId = null, onSignOut }: AppProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isBalanceVisible, setIsBalanceVisible] = useState(() =>
    parseStoredValue(scopedStorageKey(LOCAL_SHOW_BALANCES_KEY, userId), true),
  );
  const [cloudSyncReady, setCloudSyncReady] = useState(!isSupabaseConfigured || !userId);
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    parseStoredValue(scopedStorageKey(LOCAL_TRANSACTIONS_KEY, userId), INITIAL_TRANSACTIONS)
  );
  const [accounts, setAccounts] = useState<Account[]>(() =>
    normalizeStoredAccounts(parseStoredValue(scopedStorageKey(LOCAL_ACCOUNTS_KEY, userId), DEFAULT_ACCOUNTS))
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    normalizeStoredCategories(parseStoredValue(scopedStorageKey(LOCAL_CATEGORIES_KEY, userId), DEFAULT_CATEGORIES))
  );
  const [targets, setTargets] = useState<FinancialTarget[]>(() =>
    parseStoredValue(scopedStorageKey(LOCAL_TARGETS_KEY, userId), INITIAL_TARGETS)
  );
  const [allocations, setAllocations] = useState<Allocation[]>(() =>
    normalizeStoredAllocations(parseStoredValue(scopedStorageKey(LOCAL_ALLOCATIONS_KEY, userId), INITIAL_ALLOCATIONS))
  );
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isTargetManagerOpen, setIsTargetManagerOpen] = useState(false);
  const [isAllocationManagerOpen, setIsAllocationManagerOpen] = useState(false);
  const [selectedHomeTargetId, setSelectedHomeTargetId] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [cashflowFilterMode, setCashflowFilterMode] = useState<'month' | 'date'>('month');
  const [selectedCashflowMonth, setSelectedCashflowMonth] = useState(() => toMonthKey(new Date()));
  const [selectedCashflowStartDate, setSelectedCashflowStartDate] = useState(() => {
    const today = new Date();
    return toDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [selectedCashflowEndDate, setSelectedCashflowEndDate] = useState(() => toDateKey(new Date()));
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [newCategory, setNewCategory] = useState(DEFAULT_CATEGORIES[0].id);
  const [selectedAccountId, setSelectedAccountId] = useState(DEFAULT_ACCOUNTS[0].id);
  const [selectedTransactionAllocationId, setSelectedTransactionAllocationId] = useState('');
  const [transactionError, setTransactionError] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState<CategoryIconName>('Tag');
  const [categoryColor, setCategoryColor] = useState<(typeof CATEGORY_COLOR_OPTIONS)[number]>(CATEGORY_COLOR_OPTIONS[0]);
  const [categoryType, setCategoryType] = useState<CategoryType>('expense');
  const [categoryBudget, setCategoryBudget] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [targetName, setTargetName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [targetTopUpAmount, setTargetTopUpAmount] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState(INITIAL_TARGETS[0]?.id ?? '');
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState(DEFAULT_ACCOUNTS[0].id);
  const [targetCreateError, setTargetCreateError] = useState('');
  const [targetTopUpError, setTargetTopUpError] = useState('');
  const [allocationName, setAllocationName] = useState('');
  const [allocationTargetAmount, setAllocationTargetAmount] = useState('');
  const [allocationThreshold, setAllocationThreshold] = useState('20');
  const [allocationNote, setAllocationNote] = useState('');
  const [allocationIcon, setAllocationIcon] = useState<CategoryIconName>('PiggyBank');
  const [allocationColor, setAllocationColor] = useState<(typeof CATEGORY_COLOR_OPTIONS)[number]>('#34C759');
  const [allocationTopUpAmount, setAllocationTopUpAmount] = useState('');
  const [selectedAllocationId, setSelectedAllocationId] = useState(INITIAL_ALLOCATIONS[0]?.id ?? '');
  const [expandedAllocationId, setExpandedAllocationId] = useState('');
  const [allocationError, setAllocationError] = useState('');
  const [allocationTopUpError, setAllocationTopUpError] = useState('');
  const deviceId = useMemo(() => getDeviceId(), []);
  const deferredTransactionSearch = useDeferredValue(transactionSearch);

  useEffect(() => {
    setTransactions(
      parseStoredValue(scopedStorageKey(LOCAL_TRANSACTIONS_KEY, userId), INITIAL_TRANSACTIONS),
    );
    setAccounts(
      normalizeStoredAccounts(
        parseStoredValue(scopedStorageKey(LOCAL_ACCOUNTS_KEY, userId), DEFAULT_ACCOUNTS),
      ),
    );
    setCategories(
      normalizeStoredCategories(
        parseStoredValue(scopedStorageKey(LOCAL_CATEGORIES_KEY, userId), DEFAULT_CATEGORIES),
      ),
    );
    setTargets(parseStoredValue(scopedStorageKey(LOCAL_TARGETS_KEY, userId), INITIAL_TARGETS));
    setAllocations(
      normalizeStoredAllocations(
        parseStoredValue(scopedStorageKey(LOCAL_ALLOCATIONS_KEY, userId), INITIAL_ALLOCATIONS),
      ),
    );
    setIsBalanceVisible(parseStoredValue(scopedStorageKey(LOCAL_SHOW_BALANCES_KEY, userId), true));
  }, [userId]);

  useEffect(() => {
    let isActive = true;
    setCloudSyncReady(!isSupabaseConfigured || !userId);

    const syncFromCloud = async () => {
      if (!isSupabaseConfigured) {
        setCloudSyncReady(true);
        return;
      }

      if (!userId) {
        setCloudSyncReady(true);
        return;
      }

      const cloudSnapshot = await loadSnapshotFromCloud(userId);
      if (!isActive) {
        return;
      }

      if (cloudSnapshot) {
        const initialLocalUpdatedAt = localStorage.getItem(
          scopedStorageKey(LOCAL_STATE_UPDATED_AT_KEY, userId),
        );
        const cloudTimestamp = cloudSnapshot.updatedAt ? Date.parse(cloudSnapshot.updatedAt) : NaN;
        const localTimestamp = initialLocalUpdatedAt ? Date.parse(initialLocalUpdatedAt) : NaN;
        const shouldUseCloudData =
          Number.isNaN(localTimestamp) ||
          (!Number.isNaN(cloudTimestamp) && cloudTimestamp > localTimestamp);

        if (shouldUseCloudData) {
          setTransactions(
            Array.isArray(cloudSnapshot.transactions)
              ? cloudSnapshot.transactions
              : INITIAL_TRANSACTIONS,
          );
          setAccounts(
            normalizeStoredAccounts(
              Array.isArray(cloudSnapshot.accounts) ? cloudSnapshot.accounts : DEFAULT_ACCOUNTS,
            ),
          );
          setCategories(
            normalizeStoredCategories(
              Array.isArray(cloudSnapshot.categories)
                ? cloudSnapshot.categories
                : DEFAULT_CATEGORIES,
            ),
          );
          setTargets(Array.isArray(cloudSnapshot.targets) ? cloudSnapshot.targets : INITIAL_TARGETS);
          setAllocations(
            normalizeStoredAllocations(
              Array.isArray(cloudSnapshot.allocations)
                ? cloudSnapshot.allocations
                : INITIAL_ALLOCATIONS,
            ),
          );
        }
      }

      setCloudSyncReady(true);
    };

    void syncFromCloud();

    return () => {
      isActive = false;
    };
  }, [deviceId, userId]);

  useEffect(() => {
    localStorage.setItem(
      scopedStorageKey(LOCAL_TRANSACTIONS_KEY, userId),
      JSON.stringify(transactions),
    );
    localStorage.setItem(scopedStorageKey(LOCAL_ACCOUNTS_KEY, userId), JSON.stringify(accounts));
    localStorage.setItem(
      scopedStorageKey(LOCAL_CATEGORIES_KEY, userId),
      JSON.stringify(categories),
    );
    localStorage.setItem(scopedStorageKey(LOCAL_TARGETS_KEY, userId), JSON.stringify(targets));
    localStorage.setItem(
      scopedStorageKey(LOCAL_ALLOCATIONS_KEY, userId),
      JSON.stringify(allocations),
    );

    if (cloudSyncReady) {
      localStorage.setItem(
        scopedStorageKey(LOCAL_STATE_UPDATED_AT_KEY, userId),
        new Date().toISOString(),
      );
    }
  }, [transactions, accounts, categories, targets, allocations, cloudSyncReady, userId]);

  useEffect(() => {
    if (!cloudSyncReady || !isSupabaseConfigured || !userId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveSnapshotToCloud(userId, deviceId, {
        transactions,
        accounts,
        categories,
        targets,
        allocations,
      });
    }, 800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    allocations,
    accounts,
    categories,
    cloudSyncReady,
    deviceId,
    targets,
    transactions,
    userId,
  ]);

  useEffect(() => {
    localStorage.setItem(
      scopedStorageKey(LOCAL_SHOW_BALANCES_KEY, userId),
      JSON.stringify(isBalanceVisible),
    );
  }, [isBalanceVisible, userId]);

  useEffect(() => {
    setAccounts((currentAccounts) => normalizeStoredAccounts(currentAccounts));
  }, []);

  useEffect(() => {
    setAllocations((currentAllocations) => normalizeStoredAllocations(currentAllocations));
  }, []);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === newType || category.type === 'both'),
    [categories, newType]
  );

  const budgetCategories = useMemo(
    () => categories.filter((category) => category.type !== 'income' && (category.budget || 0) > 0).slice(0, 3),
    [categories]
  );

  const usedCategoryIds = useMemo(
    () => new Set(transactions.map((transaction) => transaction.categoryId)),
    [transactions]
  );

  const usedAllocationIds = useMemo(
    () =>
      new Set(
        transactions
          .map((transaction) => transaction.allocationId)
          .filter((allocationId): allocationId is string => Boolean(allocationId))
      ),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const keyword = deferredTransactionSearch.trim().toLowerCase();

    if (!keyword) return transactions;

    return transactions.filter((transaction) => {
      const category = categories.find((item) => item.id === transaction.categoryId);
      const account = accounts.find((item) => item.id === transaction.accountId);
      const allocation = allocations.find((item) => item.id === transaction.allocationId);
      const allocationLabel = allocation?.name || transaction.allocationNameSnapshot;

      return [transaction.note, category?.name, account?.name, allocationLabel]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword));
    });
  }, [accounts, allocations, categories, deferredTransactionSearch, transactions]);

  const cashflowFilteredTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) =>
          cashflowFilterMode === 'month'
            ? selectedCashflowMonth && isSameMonthValue(transaction.date, selectedCashflowMonth)
            : selectedCashflowStartDate &&
              selectedCashflowEndDate &&
              isDateWithinRange(transaction.date, selectedCashflowStartDate, selectedCashflowEndDate)
        )
        .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()),
    [cashflowFilterMode, selectedCashflowEndDate, selectedCashflowMonth, selectedCashflowStartDate, transactions]
  );

  const cashflowIncomeTransactions = useMemo(
    () => cashflowFilteredTransactions.filter((transaction) => transaction.type === 'income'),
    [cashflowFilteredTransactions]
  );

  const cashflowExpenseTransactions = useMemo(
    () => cashflowFilteredTransactions.filter((transaction) => transaction.type === 'expense'),
    [cashflowFilteredTransactions]
  );

  const cashflowIncomeTotal = useMemo(
    () => cashflowIncomeTransactions.reduce((total, transaction) => total + transaction.amount, 0),
    [cashflowIncomeTransactions]
  );

  const cashflowExpenseTotal = useMemo(
    () => cashflowExpenseTransactions.reduce((total, transaction) => total + transaction.amount, 0),
    [cashflowExpenseTransactions]
  );

  const cashflowCategoryBreakdown = useMemo(() => {
    const grouped = new Map<
      string,
      { id: string; name: string; color: string; type: TransactionType; total: number; count: number }
    >();

    cashflowFilteredTransactions.forEach((transaction) => {
      const category = categories.find((item) => item.id === transaction.categoryId);
      const key = `${transaction.type}-${transaction.categoryId}`;
      const currentValue = grouped.get(key);

      if (currentValue) {
        currentValue.total += transaction.amount;
        currentValue.count += 1;
        return;
      }

      grouped.set(key, {
        id: key,
        name: category?.name || 'Tanpa Kategori',
        color: category?.color || '#8E8E93',
        type: transaction.type,
        total: transaction.amount,
        count: 1,
      });
    });

    return Array.from(grouped.values()).sort((first, second) => second.total - first.total);
  }, [cashflowFilteredTransactions, categories]);

  const topIncomeCategory = useMemo(
    () => cashflowCategoryBreakdown.find((item) => item.type === 'income'),
    [cashflowCategoryBreakdown]
  );

  const topExpenseCategory = useMemo(
    () => cashflowCategoryBreakdown.find((item) => item.type === 'expense'),
    [cashflowCategoryBreakdown]
  );

  const selectedCashflowLabel = useMemo(() => {
    if (cashflowFilterMode === 'month') {
      if (!selectedCashflowMonth) return 'Pilih bulan';
      const [year, month] = selectedCashflowMonth.split('-').map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    }

    if (!selectedCashflowStartDate || !selectedCashflowEndDate) return 'Pilih rentang tanggal';

    const [rangeStart, rangeEnd] =
      selectedCashflowStartDate <= selectedCashflowEndDate
        ? [selectedCashflowStartDate, selectedCashflowEndDate]
        : [selectedCashflowEndDate, selectedCashflowStartDate];

    const [startYear, startMonth, startDay] = rangeStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = rangeEnd.split('-').map(Number);
    const formattedStartDate = new Date(startYear, startMonth - 1, startDay).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formattedEndDate = new Date(endYear, endMonth - 1, endDay).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `${formattedStartDate} - ${formattedEndDate}`;
  }, [cashflowFilterMode, selectedCashflowEndDate, selectedCashflowMonth, selectedCashflowStartDate]);

  const savingsCategory = useMemo(
    () => categories.find((category) => category.id === '9' || category.name.toLowerCase() === 'tabungan'),
    [categories]
  );

  const refundIncomeCategory = useMemo(
    () =>
      categories.find(
        (category) => category.id === '10' || category.name.toLowerCase() === 'pengembalian dana'
      ) || categories.find((category) => category.type === 'income'),
    [categories]
  );

  const sortedTargets = useMemo(
    () =>
      [...targets].sort((first, second) => {
        const firstProgress = first.currentAmount / first.targetAmount;
        const secondProgress = second.currentAmount / second.targetAmount;

        if (firstProgress === secondProgress) {
          return new Date(first.deadline).getTime() - new Date(second.deadline).getTime();
        }

        return secondProgress - firstProgress;
      }),
    [targets]
  );

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId),
    [selectedTargetId, targets]
  );

  const selectedHomeTarget = useMemo(
    () => sortedTargets.find((target) => target.id === selectedHomeTargetId),
    [selectedHomeTargetId, sortedTargets]
  );

  const completedTargetsCount = useMemo(
    () => targets.filter((target) => target.currentAmount >= target.targetAmount).length,
    [targets]
  );

  const selectedTransactionAllocation = useMemo(
    () => allocations.find((allocation) => allocation.id === selectedTransactionAllocationId),
    [allocations, selectedTransactionAllocationId]
  );

  const selectedAllocation = useMemo(
    () => allocations.find((allocation) => allocation.id === selectedAllocationId),
    [allocations, selectedAllocationId]
  );

  const totalBalance = useMemo(() => accounts.reduce((acc, curr) => acc + curr.balance, 0), [accounts]);

  const totalAllocatedBalance = useMemo(
    () => allocations.reduce((sum, allocation) => sum + Math.max(allocation.currentAmount, 0), 0),
    [allocations]
  );

  const freeBalance = Math.max(totalBalance - totalAllocatedBalance, 0);

  const allocationWarnings = useMemo(
    () =>
      allocations
        .map((allocation) => {
          const thresholdAmount = allocation.targetAmount * (allocation.alertThreshold / 100);

          if (allocation.currentAmount <= 0) {
            return {
              id: allocation.id,
              severity: 'empty' as const,
              title: `${allocation.name} sudah habis`,
              description: 'Tambahkan alokasi baru agar kebutuhan ini tetap aman.',
            };
          }

          if (allocation.currentAmount <= thresholdAmount) {
            return {
              id: allocation.id,
              severity: 'low' as const,
              title: `${allocation.name} hampir habis`,
              description: `Sisa ${new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(allocation.currentAmount)}. Segera isi ulang agar tidak lewat batas aman.`,
            };
          }

          return null;
        })
        .filter((warning): warning is NonNullable<typeof warning> => Boolean(warning)),
    [allocations]
  );

  const customAllocationCount = allocations.filter((allocation) => allocation.isCustom).length;
  const allocationUsageStats = useMemo(() => {
    const grouped = new Map<string, { spent: number; count: number }>();

    allocations.forEach((allocation) => {
      grouped.set(allocation.id, { spent: 0, count: 0 });
    });

    transactions.forEach((transaction) => {
      if (!transaction.allocationId) return;

      const currentValue = grouped.get(transaction.allocationId);

      if (!currentValue) return;

      currentValue.count += 1;

      if (transaction.type === 'expense') {
        currentValue.spent += transaction.amount;
      }
    });

    return grouped;
  }, [allocations, transactions]);

  useEffect(() => {
    if (accounts.length === 0) return;

    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (accounts.length === 0) return;

    if (!accounts.some((account) => account.id === selectedTargetAccountId)) {
      setSelectedTargetAccountId(accounts[0].id);
    }
  }, [accounts, selectedTargetAccountId]);

  useEffect(() => {
    if (availableCategories.length === 0) {
      setNewCategory('');
      return;
    }

    if (!availableCategories.some((category) => category.id === newCategory)) {
      setNewCategory(availableCategories[0].id);
    }
  }, [availableCategories, newCategory]);

  useEffect(() => {
    if (targets.length === 0) {
      setSelectedTargetId('');
      return;
    }

    if (!targets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(targets[0].id);
    }
  }, [selectedTargetId, targets]);

  useEffect(() => {
    if (selectedHomeTargetId && !targets.some((target) => target.id === selectedHomeTargetId)) {
      setSelectedHomeTargetId('');
    }
  }, [selectedHomeTargetId, targets]);

  useEffect(() => {
    if (allocations.length === 0) {
      setSelectedAllocationId('');
      setExpandedAllocationId('');
      return;
    }

    if (!allocations.some((allocation) => allocation.id === selectedAllocationId)) {
      setSelectedAllocationId(allocations[0].id);
    }
  }, [allocations, selectedAllocationId]);

  useEffect(() => {
    if (expandedAllocationId && !allocations.some((allocation) => allocation.id === expandedAllocationId)) {
      setExpandedAllocationId('');
    }
  }, [allocations, expandedAllocationId]);

  useEffect(() => {
    if (newType === 'income') {
      setSelectedTransactionAllocationId('');
      setTransactionError('');
    }
  }, [newType]);

  useEffect(() => {
    if (
      selectedTransactionAllocationId &&
      !allocations.some((allocation) => allocation.id === selectedTransactionAllocationId)
    ) {
      setSelectedTransactionAllocationId('');
    }
  }, [allocations, selectedTransactionAllocationId]);

  // Calculate totals
  const currentMonthKey = toMonthKey(new Date());
  const monthlyIncome = useMemo(() => transactions
    .filter(t => t.type === 'income' && isSameMonthValue(t.date, currentMonthKey))
    .reduce((acc, curr) => acc + curr.amount, 0), [transactions]);
  const monthlyExpense = useMemo(() => transactions
    .filter(t => t.type === 'expense' && isSameMonthValue(t.date, currentMonthKey))
    .reduce((acc, curr) => acc + curr.amount, 0), [transactions]);

  const parseNumericInput = (value: string) => value.replace(/\D/g, '');
  const formatNumericInput = (value: string) => {
    if (!value) return '';

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return '';

    return parsedValue.toLocaleString('id-ID');
  };
  const formatCurrency = (amount: number) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const isNegative = safeAmount < 0;
    const absoluteValue = Math.round(Math.abs(safeAmount));
    return `${isNegative ? '-' : ''}Rp ${absoluteValue.toLocaleString('id-ID')}`;
  };

  const displayCurrency = (amount: number) =>
    isBalanceVisible ? formatCurrency(amount) : 'Rp ******';

  const resetCategoryDraft = (type: CategoryType = newType) => {
    setCategoryName('');
    setCategoryIcon('Tag');
    setCategoryColor(CATEGORY_COLOR_OPTIONS[0]);
    setCategoryType(type);
    setCategoryBudget('');
    setCategoryError('');
  };

  const openCategoryManager = () => {
    resetCategoryDraft(newType);
    setIsCategoryManagerOpen(true);
  };

  const closeCategoryManager = () => {
    setIsCategoryManagerOpen(false);
    setCategoryError('');
  };

  const resetTargetDraft = () => {
    setTargetName('');
    setTargetAmount('');
    setTargetDeadline('');
    setTargetTopUpAmount('');
    setTargetCreateError('');
    setTargetTopUpError('');
  };

  const openTargetManager = (targetId?: string) => {
    if (targetId) {
      setSelectedTargetId(targetId);
    }

    resetTargetDraft();
    setTargetCreateError('');
    setTargetTopUpError('');
    setIsTargetManagerOpen(true);
  };

  const closeTargetManager = () => {
    setIsTargetManagerOpen(false);
    resetTargetDraft();
    setTargetCreateError('');
    setTargetTopUpError('');
  };

  const resetAllocationDraft = () => {
    setAllocationName('');
    setAllocationTargetAmount('');
    setAllocationThreshold('20');
    setAllocationNote('');
    setAllocationIcon('PiggyBank');
    setAllocationColor('#34C759');
    setAllocationTopUpAmount('');
    setAllocationError('');
    setAllocationTopUpError('');
  };

  const openAllocationManager = (allocationId?: string) => {
    if (allocationId) {
      setSelectedAllocationId(allocationId);
      setExpandedAllocationId(allocationId);
    }

    setAllocationError('');
    setAllocationTopUpError('');
    setAllocationTopUpAmount('');
    setIsAllocationManagerOpen(true);
  };

  const closeAllocationManager = () => {
    setIsAllocationManagerOpen(false);
    setExpandedAllocationId('');
    resetAllocationDraft();
  };

  const formatTargetDeadline = (date: string) =>
    new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const getTargetProgressColor = (progress: number) => {
    const clampedProgress = Math.max(0, Math.min(progress, 100));
    return `hsl(${Math.round(clampedProgress * 1.2)}, 88%, 58%)`;
  };

  const getAllocationStatus = (allocation: Allocation) => {
    const thresholdAmount = allocation.targetAmount * (allocation.alertThreshold / 100);

    if (allocation.currentAmount <= 0) {
      return {
        label: 'Habis',
        color: 'text-[var(--color-ios-red)]',
        badge: 'bg-red-50 text-[var(--color-ios-red)]',
        fill: 'var(--color-ios-red)',
      };
    }

    if (allocation.currentAmount <= thresholdAmount) {
      return {
        label: 'Menipis',
        color: 'text-amber-600',
        badge: 'bg-amber-50 text-amber-700',
        fill: '#F59E0B',
      };
    }

    return {
      label: 'Aman',
      color: 'text-[var(--color-ios-green)]',
      badge: 'bg-green-50 text-[var(--color-ios-green)]',
      fill: 'var(--color-ios-green)',
    };
  };

  const openAllocationDetail = (allocationId: string) => {
    setSelectedAllocationId(allocationId);
    setExpandedAllocationId(allocationId);
  };

  const toggleAllocationDetail = (allocationId: string) => {
    setSelectedAllocationId(allocationId);
    setExpandedAllocationId((currentId) => (currentId === allocationId ? '' : allocationId));
  };

  const handleAddTransaction = () => {
    const parsedAmount = Number(newAmount);
    setTransactionError('');

    if (!parsedAmount || Number.isNaN(parsedAmount) || !newCategory || !selectedAccountId) return;

    if (newType === 'expense' && selectedTransactionAllocationId) {
      const selectedAllocationForTransaction = allocations.find(
        (allocation) => allocation.id === selectedTransactionAllocationId
      );

      if (!selectedAllocationForTransaction) {
        setTransactionError('Pos alokasi yang dipilih tidak ditemukan.');
        return;
      }

      if (parsedAmount > selectedAllocationForTransaction.currentAmount) {
        setTransactionError(
          `Sisa alokasi ${selectedAllocationForTransaction.name} tinggal ${formatCurrency(selectedAllocationForTransaction.currentAmount)}.`
        );
        return;
      }
    }

    const transaction: Transaction = {
      id: createId('txn'),
      amount: parsedAmount,
      type: newType,
      categoryId: newCategory,
      accountId: selectedAccountId,
      date: new Date().toISOString(),
      note: newNote || (newType === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      allocationId: newType === 'expense' && selectedTransactionAllocationId ? selectedTransactionAllocationId : undefined,
      allocationNameSnapshot:
        newType === 'expense' && selectedTransactionAllocation
          ? selectedTransactionAllocation.name
          : undefined,
    };

    setTransactions((currentTransactions) => [transaction, ...currentTransactions]);
    
    // Update account balance
    setAccounts(accounts.map(acc => {
      if (acc.id === transaction.accountId) {
        return {
          ...acc,
          balance: newType === 'income' ? acc.balance + transaction.amount : acc.balance - transaction.amount
        };
      }
      return acc;
    }));

    if (transaction.allocationId) {
      setAllocations((currentAllocations) =>
        currentAllocations.map((allocation) =>
          allocation.id === transaction.allocationId
            ? { ...allocation, currentAmount: Math.max(allocation.currentAmount - transaction.amount, 0) }
            : allocation
        )
      );
    }

    setIsAddModalOpen(false);
    setNewAmount('');
    setNewNote('');
    setSelectedTransactionAllocationId('');
    setTransactionError('');
  };

  const handleCreateTarget = () => {
    const trimmedName = targetName.trim();
    const parsedAmount = Number(targetAmount);
    setTargetCreateError('');

    if (!trimmedName) {
      setTargetCreateError('Nama target belum diisi.');
      return;
    }

    if (!targetDeadline) {
      setTargetCreateError('Tanggal target belum dipilih.');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setTargetCreateError('Nominal target harus lebih besar dari nol.');
      return;
    }

    const createdTarget: FinancialTarget = {
      id: createId('goal'),
      name: trimmedName,
      targetAmount: parsedAmount,
      currentAmount: 0,
      deadline: targetDeadline,
    };

    setTargets((currentTargets) => [createdTarget, ...currentTargets]);
    setSelectedTargetId(createdTarget.id);
    setTargetName('');
    setTargetAmount('');
    setTargetDeadline('');
    setTargetCreateError('');
  };

  const handleTopUpTarget = () => {
    const parsedAmount = Number(targetTopUpAmount);
    const fundingAccount = accounts.find((account) => account.id === selectedTargetAccountId);
    const target = targets.find((item) => item.id === selectedTargetId);
    setTargetTopUpError('');

    if (!target) {
      setTargetTopUpError('Pilih target yang ingin ditambah.');
      return;
    }

    if (!fundingAccount) {
      setTargetTopUpError('Pilih akun sumber dana terlebih dahulu.');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setTargetTopUpError('Nominal setor harus lebih besar dari nol.');
      return;
    }

    const remainingAmount = target.targetAmount - target.currentAmount;

    if (remainingAmount <= 0) {
      setTargetTopUpError('Target ini sudah tercapai.');
      return;
    }

    if (parsedAmount > remainingAmount) {
      setTargetTopUpError(`Maksimal setor untuk target ini adalah ${formatCurrency(remainingAmount)}.`);
      return;
    }

    if (parsedAmount > fundingAccount.balance) {
      setTargetTopUpError(`Saldo ${fundingAccount.name} tidak mencukupi.`);
      return;
    }

    setTargets((currentTargets) =>
      currentTargets.map((item) =>
        item.id === target.id
          ? { ...item, currentAmount: item.currentAmount + parsedAmount }
          : item
      )
    );

    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === fundingAccount.id
          ? { ...account, balance: account.balance - parsedAmount }
          : account
      )
    );

    if (savingsCategory) {
      setTransactions((currentTransactions) => [
        {
          id: createId('txn'),
          amount: parsedAmount,
          type: 'expense',
          categoryId: savingsCategory.id,
          accountId: fundingAccount.id,
          date: new Date().toISOString(),
          note: `Setor target: ${target.name}`,
        },
        ...currentTransactions,
      ]);
    }

    setTargetTopUpAmount('');
    setTargetTopUpError('');
  };

  const handleDeleteTarget = (targetId: string) => {
    const target = targets.find((item) => item.id === targetId);
    const refundAccount = accounts.find((account) => account.id === selectedTargetAccountId) ?? accounts[0];

    if (!target || !refundAccount) {
      return;
    }

    const hasStoredFunds = target.currentAmount > 0;
    const refundMessage = hasStoredFunds
      ? `Dana terkumpul ${formatCurrency(target.currentAmount)} akan dikembalikan ke ${refundAccount.name}.`
      : '';
    const confirmationMessage = `Hapus target "${target.name}"? ${refundMessage}`.trim();

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setTargets((currentTargets) => currentTargets.filter((item) => item.id !== target.id));

    if (!hasStoredFunds) {
      return;
    }

    setAccounts((currentAccounts) =>
      currentAccounts.map((account) =>
        account.id === refundAccount.id
          ? { ...account, balance: account.balance + target.currentAmount }
          : account
      )
    );

    if (refundIncomeCategory) {
      setTransactions((currentTransactions) => [
        {
          id: createId('txn'),
          amount: target.currentAmount,
          type: 'income',
          categoryId: refundIncomeCategory.id,
          accountId: refundAccount.id,
          date: new Date().toISOString(),
          note: `Pengembalian target: ${target.name}`,
        },
        ...currentTransactions,
      ]);
    }
  };

  const handleCreateCategory = () => {
    const trimmedName = categoryName.trim();
    const parsedBudget = categoryBudget ? Number(categoryBudget) : undefined;

    if (!trimmedName) {
      setCategoryError('Nama kategori belum diisi.');
      return;
    }

    if (categories.some((category) => category.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCategoryError('Nama kategori sudah digunakan.');
      return;
    }

    if (parsedBudget !== undefined && (Number.isNaN(parsedBudget) || parsedBudget < 0)) {
      setCategoryError('Budget kategori harus berupa angka yang valid.');
      return;
    }

    const createdCategory: Category = {
      id: createId('cat'),
      name: trimmedName,
      icon: categoryIcon,
      color: categoryColor,
      type: categoryType,
      budget: categoryType === 'income' ? undefined : parsedBudget,
      isCustom: true,
    };

    setCategories((currentCategories) => [createdCategory, ...currentCategories]);

    if (createdCategory.type === newType || createdCategory.type === 'both') {
      setNewCategory(createdCategory.id);
    }

    closeCategoryManager();
    resetCategoryDraft(newType);
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (usedCategoryIds.has(categoryId)) return;

    setCategories((currentCategories) =>
      currentCategories.filter((category) => category.id !== categoryId)
    );
  };

  const handleDeleteBudgetCategory = (
    categoryId: string,
    options?: { budgetOnly?: boolean }
  ) => {
    const selectedCategory = categories.find((category) => category.id === categoryId);
    if (!selectedCategory) return;

    if (options?.budgetOnly) {
      const shouldRemoveBudget = window.confirm(
        `Hapus budget untuk kategori "${selectedCategory.name}"? Kategori tetap tersimpan.`
      );

      if (!shouldRemoveBudget) return;

      setCategories((currentCategories) =>
        currentCategories.map((category) =>
          category.id === categoryId ? { ...category, budget: undefined } : category
        )
      );
      return;
    }

    const isCategoryUsed = usedCategoryIds.has(categoryId);

    if (selectedCategory.isCustom && !isCategoryUsed) {
      const shouldDeleteCategory = window.confirm(
        `Hapus kategori "${selectedCategory.name}" dari daftar kategori?`
      );

      if (shouldDeleteCategory) {
        handleDeleteCategory(categoryId);
        return;
      }
    }

    const shouldRemoveBudget = window.confirm(
      `Hapus budget untuk kategori "${selectedCategory.name}"? Kategori tetap tersimpan.`
    );

    if (!shouldRemoveBudget) return;

    setCategories((currentCategories) =>
      currentCategories.map((category) =>
        category.id === categoryId ? { ...category, budget: undefined } : category
      )
    );
  };

  const handleCreateAllocation = () => {
    const trimmedName = allocationName.trim();
    const parsedTargetAmount = Number(allocationTargetAmount);
    const parsedThreshold = Number(allocationThreshold);
    setAllocationError('');

    if (!trimmedName) {
      setAllocationError('Nama pos alokasi belum diisi.');
      return;
    }

    if (allocations.some((allocation) => allocation.name.toLowerCase() === trimmedName.toLowerCase())) {
      setAllocationError('Nama pos alokasi sudah digunakan.');
      return;
    }

    if (!parsedTargetAmount || parsedTargetAmount <= 0) {
      setAllocationError('Nominal target alokasi harus lebih besar dari nol.');
      return;
    }

    if (!parsedThreshold || parsedThreshold <= 0 || parsedThreshold >= 100) {
      setAllocationError('Batas peringatan harus di antara 1 sampai 99 persen.');
      return;
    }

    const createdAllocation: Allocation = {
      id: createId('alloc'),
      name: trimmedName,
      icon: allocationIcon,
      color: allocationColor,
      targetAmount: parsedTargetAmount,
      currentAmount: 0,
      alertThreshold: parsedThreshold,
      note: allocationNote.trim() || undefined,
      isCustom: true,
    };

    setAllocations((currentAllocations) => [createdAllocation, ...currentAllocations]);
    setSelectedAllocationId(createdAllocation.id);
    resetAllocationDraft();
  };

  const handleTopUpAllocation = () => {
    const parsedAmount = Number(allocationTopUpAmount);
    setAllocationTopUpError('');

    if (!selectedAllocation) {
      setAllocationTopUpError('Pilih pos alokasi yang ingin diisi.');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setAllocationTopUpError('Nominal alokasi harus lebih besar dari nol.');
      return;
    }

    if (parsedAmount > freeBalance) {
      setAllocationTopUpError(`Saldo bebas saat ini tinggal ${formatCurrency(freeBalance)}.`);
      return;
    }

    setAllocations((currentAllocations) =>
      currentAllocations.map((allocation) =>
        allocation.id === selectedAllocation.id
          ? { ...allocation, currentAmount: allocation.currentAmount + parsedAmount }
          : allocation
      )
    );

    setAllocationTopUpAmount('');
    setAllocationTopUpError('');
  };

  const handleDeleteAllocation = (allocationId: string) => {
    const targetAllocation = allocations.find((allocation) => allocation.id === allocationId);

    if (!targetAllocation) {
      return;
    }

    const hasRemainingBalance = targetAllocation.currentAmount > 0;
    const hasTransactionHistory = usedAllocationIds.has(allocationId);
    const balanceMessage = hasRemainingBalance
      ? `Sisa ${formatCurrency(targetAllocation.currentAmount)} akan kembali menjadi saldo bebas. `
      : '';
    const historyMessage = hasTransactionHistory
      ? 'Riwayat transaksi tetap disimpan.'
      : '';
    const confirmationMessage = `Hapus pos alokasi "${targetAllocation.name}"? ${balanceMessage}${historyMessage}`.trim();

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    if (hasTransactionHistory) {
      setTransactions((currentTransactions) =>
        currentTransactions.map((transaction) =>
          transaction.allocationId === allocationId
            ? {
                ...transaction,
                allocationId: undefined,
                allocationNameSnapshot: transaction.allocationNameSnapshot || targetAllocation.name,
              }
            : transaction
        )
      );
    }

    setAllocations((currentAllocations) =>
      currentAllocations.filter((allocation) => allocation.id !== allocationId)
    );

    if (selectedTransactionAllocationId === allocationId) {
      setSelectedTransactionAllocationId('');
    }
  };

  const handleResetAllData = () => {
    const shouldReset = window.confirm(
      'Reset semua data aplikasi dan mulai dari nol? Data transaksi, target, dan alokasi akan dihapus.'
    );

    if (!shouldReset) return;

    const resetAccounts = DEFAULT_ACCOUNTS.map((account) => ({
      ...account,
      balance: 0,
    }));

    setTransactions([]);
    setAccounts(resetAccounts);
    setTargets([]);
    setAllocations([]);
    setSelectedTargetId('');
    setSelectedTargetAccountId(resetAccounts[0]?.id ?? '');
    setSelectedAllocationId('');
    setExpandedAllocationId('');
    setSelectedHomeTargetId('');
    setSelectedTransactionAllocationId('');
    setTransactionSearch('');
    setNewAmount('');
    setNewNote('');
    setTargetTopUpAmount('');
    setTargetAmount('');
    setTargetName('');
    setTargetDeadline('');
    setAllocationTopUpAmount('');
    setAllocationTargetAmount('');
    setAllocationName('');
    setTransactionError('');
    setTargetCreateError('');
    setTargetTopUpError('');
    setAllocationError('');
    setAllocationTopUpError('');
  };

  const canSubmitTransaction = Number(newAmount) > 0 && Boolean(newCategory) && Boolean(selectedAccountId);
  const customCategoryCount = categories.filter((category) => category.isCustom).length;
  const canCreateTarget = Boolean(targetName.trim()) && Number(targetAmount) > 0 && Boolean(targetDeadline);
  const canTopUpTarget = Boolean(selectedTargetId) && Number(targetTopUpAmount) > 0 && Boolean(selectedTargetAccountId);
  const canCreateAllocation = Boolean(allocationName.trim()) && Number(allocationTargetAmount) > 0;
  const canTopUpAllocation = Boolean(selectedAllocationId) && Number(allocationTopUpAmount) > 0;

  const chartData = useMemo(() => {
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = toMonthKey(d);
      const monthName = d.toLocaleDateString('id-ID', { month: 'short' });
      const income = transactions
        .filter(t => t.type === 'income' && isSameMonthValue(t.date, monthKey))
        .reduce((acc, curr) => acc + curr.amount, 0);
      const expense = transactions
        .filter(t => t.type === 'expense' && isSameMonthValue(t.date, monthKey))
        .reduce((acc, curr) => acc + curr.amount, 0);
      last6Months.push({ name: monthName, income, expense });
    }
    return last6Months;
  }, [transactions]);

  if (isLocked) return <PinScreen onUnlock={() => setIsLocked(false)} />;

  return (
    <div className="max-w-md mx-auto min-h-screen relative pb-28 bg-transparent">
      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-5 pt-9 space-y-7"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8D96A5]">Selamat Pagi</p>
                <h1 className="text-[30px] leading-[1.05] font-bold text-[#111827] mt-1">Nawfal Elmadany</h1>
              </div>
              <div className="flex space-x-3">
                <button className="w-11 h-11 rounded-full bg-white/82 backdrop-blur-md border border-white/80 shadow-[0_10px_24px_rgba(15,23,42,0.12)] active:scale-95 transition-all flex items-center justify-center">
                  <Bell size={19} className="text-[#788192]" />
                </button>
                <button className="w-11 h-11 rounded-full bg-white/82 backdrop-blur-md border border-white/80 shadow-[0_10px_24px_rgba(15,23,42,0.12)] active:scale-95 transition-all flex items-center justify-center">
                  <Search size={19} className="text-[#788192]" />
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className="w-full text-left rounded-[30px] px-6 py-6 bg-gradient-to-br from-[#1F7BFF] via-[#3D9DFF] to-[#64C7FF] text-white overflow-hidden relative active:scale-[0.99] transition-all duration-300 border border-white/35 shadow-[0_24px_46px_rgba(28,120,255,0.35)]"
              aria-label="Buka rincian pemasukan dan pengeluaran"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/25 rounded-full -mr-14 -mt-14 blur-3xl" />
              <div className="absolute -bottom-16 -left-8 w-40 h-40 bg-[#0D5CE4]/35 rounded-full blur-3xl" />
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsBalanceVisible((currentValue) => !currentValue);
                }}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/22 border border-white/40 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center z-10"
                aria-label={isBalanceVisible ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
              >
                {isBalanceVisible ? (
                  <EyeOff size={18} className="text-white" />
                ) : (
                  <Eye size={18} className="text-white" />
                )}
              </button>
              <p className="text-white/82 text-sm font-semibold">Total Saldo</p>
              <h2 className="text-[42px] leading-[1.05] font-bold mt-1 tracking-[-0.02em]">{displayCurrency(totalBalance)}</h2>
              
              <div className="flex justify-between mt-7 pt-4 border-t border-white/25">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-white/24 rounded-full">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/75 uppercase tracking-wider font-bold">Income</p>
                    <p className="text-sm font-bold">{displayCurrency(monthlyIncome)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-white/24 rounded-full">
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/75 uppercase tracking-wider font-bold">Expense</p>
                    <p className="text-sm font-bold">{displayCurrency(monthlyExpense)}</p>
                  </div>
                </div>
              </div>
            </button>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  icon: Plus,
                  label: 'Add',
                  surface: 'bg-gradient-to-br from-[#EDF5FF] to-[#DAE9FF]',
                  tint: 'text-[#1473FF]',
                  onClick: () => setIsAddModalOpen(true),
                },
                {
                  icon: Wallet,
                  label: 'Alokasi',
                  surface: 'bg-gradient-to-br from-[#EDFBF2] to-[#D8F6E6]',
                  tint: 'text-[#18A957]',
                  onClick: () => openAllocationManager(),
                },
                {
                  icon: Tag,
                  label: 'Kategori',
                  surface: 'bg-gradient-to-br from-[#EEF1FF] to-[#DFE4FF]',
                  tint: 'text-[#5A57E8]',
                  onClick: openCategoryManager,
                },
                {
                  icon: Target,
                  label: 'Target',
                  surface: 'bg-gradient-to-br from-[#FFF5EB] to-[#FFE6CF]',
                  tint: 'text-[#FF6A00]',
                  onClick: () => openTargetManager(),
                },
              ].map((action, i) => (
                <button 
                  key={i} 
                  onClick={action.onClick}
                  className="flex flex-col items-center space-y-2 group"
                >
                  <div
                    className={cn(
                      "relative w-16 h-16 rounded-[20px] border border-white/80 transition-all duration-200 flex items-center justify-center group-active:scale-95 shadow-[0_14px_26px_rgba(15,23,42,0.10)] group-active:shadow-[0_6px_12px_rgba(15,23,42,0.1)]",
                      action.surface
                    )}
                  >
                    <div className="absolute inset-0 rounded-[20px] bg-white/35" />
                    <action.icon className={cn("relative", action.tint)} size={22} strokeWidth={2.4} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#687285]">{action.label}</span>
                </button>
              ))}
            </div>

            {allocationWarnings.length > 0 && (
              <div className="ios-card space-y-3 border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">Peringatan Alokasi</h3>
                      <p className="text-sm text-[var(--color-ios-gray)]">
                        Ada {allocationWarnings.length} pos alokasi yang perlu diperhatikan.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => openAllocationManager()} className="text-[var(--color-ios-blue)] text-sm font-semibold">
                    Kelola
                  </button>
                </div>

                <div className="space-y-2">
                  {allocationWarnings.slice(0, 3).map((warning) => (
                    <button
                      key={warning.id}
                      onClick={() => openAllocationManager(warning.id)}
                      className={cn(
                        "w-full rounded-2xl px-4 py-3 text-left transition-all",
                        warning.severity === 'empty' ? "bg-red-50" : "bg-amber-50"
                      )}
                    >
                      <p
                        className={cn(
                          "text-sm font-bold",
                          warning.severity === 'empty' ? "text-[var(--color-ios-red)]" : "text-amber-700"
                        )}
                      >
                        {warning.title}
                      </p>
                      <p className="text-xs text-[var(--color-ios-gray)] mt-1">{warning.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Alokasi Dana</h3>
                  <p className="text-xs text-[var(--color-ios-gray)]">Pisahkan saldo untuk kebutuhan penting, tabungan, dan pengeluaran rutin.</p>
                </div>
                <button onClick={() => openAllocationManager()} className="text-[var(--color-ios-blue)] text-sm font-semibold">Atur</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Saldo bebas</p>
                  <p className="text-lg font-bold mt-1">{formatCurrency(freeBalance)}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">Siap dialokasikan dari saldo yang ada</p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Pos aktif</p>
                  <p className="text-lg font-bold mt-1">{allocations.length}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">{allocationWarnings.length} butuh perhatian</p>
                </div>
              </div>

              {allocations.length === 0 ? (
                <div className="ios-card text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mx-auto">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="font-bold">Belum ada alokasi</p>
                    <p className="text-sm text-[var(--color-ios-gray)]">Buat pos pertama untuk dana darurat, jajan, atau kebutuhan lain.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocations.slice(0, 3).map((allocation) => {
                    const allocationStatus = getAllocationStatus(allocation);
                    const progress = allocation.targetAmount > 0
                      ? Math.min((allocation.currentAmount / allocation.targetAmount) * 100, 100)
                      : 0;

                    return (
                      <button
                        key={allocation.id}
                        onClick={() => openAllocationManager(allocation.id)}
                        className="ios-card w-full text-left space-y-3 active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center"
                              style={{ backgroundColor: allocation.color }}
                            >
                              <CategoryIcon icon={allocation.icon} size={20} />
                            </div>
                            <div>
                              <p className="font-bold">{allocation.name}</p>
                              <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">
                                Sisa {formatCurrency(allocation.currentAmount)} dari target {formatCurrency(allocation.targetAmount)}
                              </p>
                            </div>
                          </div>
                          <span className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold", allocationStatus.badge)}>
                            {allocationStatus.label}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 rounded-full bg-[#F2F2F7] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${progress}%`, backgroundColor: allocationStatus.fill }}
                            />
                          </div>
                          <p className="text-[11px] text-[var(--color-ios-gray)]">
                            Batas peringatan aktif di {allocation.alertThreshold}% dari target alokasi.
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Budgeting Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Budget Bulanan</h3>
                  <p className="text-xs text-[var(--color-ios-gray)]">Kategori kustom akan muncul otomatis.</p>
                </div>
                <button onClick={openCategoryManager} className="text-[var(--color-ios-blue)] text-sm font-semibold">Atur</button>
              </div>
              <div className="ios-card space-y-4">
                {budgetCategories.map((cat) => {
                  const spent = transactions
                    .filter(t => t.categoryId === cat.id && t.type === 'expense')
                    .reduce((acc, curr) => acc + curr.amount, 0);
                  const budget = cat.budget || 1000000;
                  const percent = Math.min((spent / budget) * 100, 100);
                  
                  return (
                    <div key={cat.id} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <div className="flex items-center space-x-2">
                          <CategoryIcon icon={cat.icon} size={14} className="text-[var(--color-ios-gray)]" />
                          <span>{cat.name}</span>
                        </div>
                        <span className={cn(percent > 90 ? "text-[var(--color-ios-red)]" : "text-[var(--color-ios-gray)]")}>
                          {formatCurrency(spent)} / {formatCurrency(budget)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          className={cn(
                            "h-full rounded-full",
                            percent > 90 ? "bg-[var(--color-ios-red)]" : "bg-[var(--color-ios-blue)]"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Targets */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Target Menabung</h3>
                <button onClick={() => openTargetManager()} className="text-[var(--color-ios-blue)]">
                  <Plus size={20} className="cursor-pointer" />
                </button>
              </div>
              {sortedTargets.length === 0 ? (
                <div className="ios-card text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto">
                    <Target size={24} />
                  </div>
                  <div>
                    <p className="font-bold">Belum ada target</p>
                    <p className="text-sm text-[var(--color-ios-gray)]">Buat target pertama Anda dari menu ini.</p>
                  </div>
                </div>
              ) : (
                <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2">
                  {sortedTargets.map((target) => {
                    const progress = Math.min((target.currentAmount / target.targetAmount) * 100, 100);

                    return (
                      <button
                        type="button"
                        key={target.id}
                        onClick={() => setSelectedHomeTargetId(target.id)}
                        className="min-w-[220px] text-left rounded-[22px] p-4 space-y-3 border border-white/85 bg-white/75 backdrop-blur-md shadow-[0_14px_28px_rgba(15,23,42,0.12)] active:scale-[0.98] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-bold text-[#111827] line-clamp-1">{target.name}</p>
                          <span className="text-[11px] font-bold text-[#2F7CFF]">{Math.round(progress)}%</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-1.5 bg-[#DDE6F3] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: getTargetProgressColor(progress),
                                boxShadow: `0 0 10px ${getTargetProgressColor(progress)}66`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-[#6F7888]">Tap untuk lihat detail</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Transaksi Terakhir</h3>
                <button 
                  onClick={() => setActiveTab('transactions')}
                  className="text-[var(--color-ios-blue)] text-sm font-semibold active:opacity-60"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="space-y-3">
                {transactions.slice(0, 5).map((t) => {
                  const category = categories.find(c => c.id === t.categoryId);
                  const allocation = allocations.find((item) => item.id === t.allocationId);
                  const allocationLabel = allocation?.name || t.allocationNameSnapshot;
                  return (
                    <motion.div 
                      layout
                      key={t.id} 
                      className="ios-card flex items-center justify-between p-4 active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-4">
                        <div 
                          className="p-3 rounded-2xl text-white" 
                          style={{ backgroundColor: category?.color || '#8E8E93' }}
                        >
                          <CategoryIcon icon={category?.icon} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{t.note}</p>
                          <p className="text-[11px] text-[var(--color-ios-gray)] font-medium">
                            {[category?.name, allocationLabel, new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        </div>
                      </div>
                      <p className={cn(
                        "font-bold text-sm",
                        t.type === 'income' ? "text-[var(--color-ios-green)]" : "text-black"
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="px-6 pt-12 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Semua Transaksi</h1>
                <p className="text-sm text-[var(--color-ios-gray)]">Cari berdasarkan catatan, kategori, alokasi, atau akun.</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-11 h-11 rounded-2xl bg-[var(--color-ios-blue)] text-white flex items-center justify-center shadow-lg shadow-blue-200 active:scale-95 transition-all"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-ios-gray)]" size={18} />
              <input 
                type="text" 
                value={transactionSearch}
                onChange={(e) => setTransactionSearch(e.target.value)}
                placeholder="Cari transaksi..." 
                className="ios-input pl-12"
              />
            </div>
            
            <div className="space-y-6 pb-4">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <CreditCard size={32} className="text-gray-300" />
                  </div>
                  <p className="text-[var(--color-ios-gray)] font-medium">
                    {transactions.length === 0 ? 'Belum ada transaksi' : 'Tidak ada hasil yang cocok'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map(t => {
                    const category = categories.find(c => c.id === t.categoryId);
                    const account = accounts.find((acc) => acc.id === t.accountId);
                    const allocation = allocations.find((item) => item.id === t.allocationId);
                    const allocationLabel = allocation?.name || t.allocationNameSnapshot;
                    return (
                      <div key={t.id} className="ios-card flex items-center justify-between p-4">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 rounded-2xl text-white" style={{ backgroundColor: category?.color || '#8E8E93' }}>
                            <CategoryIcon icon={category?.icon} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{t.note}</p>
                            <p className="text-[11px] text-[var(--color-ios-gray)]">
                              {[category?.name, allocationLabel, account?.name, new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </div>
                        </div>
                        <p className={cn(
                          "font-bold text-sm",
                          t.type === 'income' ? "text-[var(--color-ios-green)]" : "text-black"
                        )}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div
            key="reports"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="px-6 pt-12 space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Laporan Keuangan</h1>
              <p className="text-sm text-[var(--color-ios-gray)] mt-1">Analisis detail untuk {selectedCashflowLabel}</p>
            </div>

            <div className="ios-card space-y-4">
              <div className="flex bg-[#F2F2F7] p-1 rounded-2xl">
                <button
                  onClick={() => setCashflowFilterMode('month')}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold text-sm transition-all",
                    cashflowFilterMode === 'month' ? "bg-white shadow-sm text-black" : "text-[var(--color-ios-gray)]"
                  )}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setCashflowFilterMode('date')}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold text-sm transition-all",
                    cashflowFilterMode === 'date' ? "bg-white shadow-sm text-black" : "text-[var(--color-ios-gray)]"
                  )}
                >
                  Per Tanggal
                </button>
              </div>

              {cashflowFilterMode === 'month' ? (
                <input
                  type="month"
                  value={selectedCashflowMonth}
                  onChange={(e) => setSelectedCashflowMonth(e.target.value)}
                  className="ios-input"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">
                      Dari tanggal
                    </p>
                    <input
                      type="date"
                      value={selectedCashflowStartDate}
                      max={selectedCashflowEndDate || undefined}
                      onChange={(e) => {
                        const nextStartDate = e.target.value;
                        setSelectedCashflowStartDate(nextStartDate);

                        if (selectedCashflowEndDate && nextStartDate > selectedCashflowEndDate) {
                          setSelectedCashflowEndDate(nextStartDate);
                        }
                      }}
                      className="ios-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">
                      Sampai tanggal
                    </p>
                    <input
                      type="date"
                      value={selectedCashflowEndDate}
                      min={selectedCashflowStartDate || undefined}
                      onChange={(e) => {
                        const nextEndDate = e.target.value;
                        setSelectedCashflowEndDate(nextEndDate);

                        if (selectedCashflowStartDate && nextEndDate < selectedCashflowStartDate) {
                          setSelectedCashflowStartDate(nextEndDate);
                        }
                      }}
                      className="ios-input"
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="ios-card h-64 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#8E8E93' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f5f5f5' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="income" fill="var(--color-ios-green)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="var(--color-ios-red)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="ios-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-[var(--color-ios-gray)] uppercase">Pemasukan</p>
                <p className="text-lg font-bold text-[var(--color-ios-green)]">{formatCurrency(cashflowIncomeTotal)}</p>
              </div>
              <div className="ios-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-[var(--color-ios-gray)] uppercase">Pengeluaran</p>
                <p className="text-lg font-bold text-[var(--color-ios-red)]">{formatCurrency(cashflowExpenseTotal)}</p>
              </div>
              <div className="ios-card p-4 space-y-1">
                <p className="text-[10px] font-bold text-[var(--color-ios-gray)] uppercase">Selisih</p>
                <p className="text-lg font-bold text-[var(--color-ios-blue)]">{formatCurrency(cashflowIncomeTotal - cashflowExpenseTotal)}</p>
              </div>
            </div>

            <div className="ios-card space-y-4">
              <h3 className="font-bold text-sm">Pengeluaran Per Kategori</h3>
              {cashflowCategoryBreakdown.filter((item) => item.type === 'expense').length === 0 ? (
                <p className="text-sm text-[var(--color-ios-gray)]">Tidak ada pengeluaran pada periode ini.</p>
              ) : (
                cashflowCategoryBreakdown
                  .filter((item) => item.type === 'expense')
                  .map((item) => {
                    const percentage = cashflowExpenseTotal > 0 ? (item.total / cashflowExpenseTotal) * 100 : 0;

                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.name}</span>
                          </div>
                          <span>{formatCurrency(item.total)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="ios-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">Daftar Transaksi Periode Ini</h3>
                <span className="text-xs font-bold text-[var(--color-ios-gray)]">{cashflowFilteredTransactions.length} item</span>
              </div>

              {cashflowFilteredTransactions.length === 0 ? (
                <p className="text-sm text-[var(--color-ios-gray)]">Belum ada transaksi pada periode yang dipilih.</p>
              ) : (
                <div className="space-y-3">
                  {cashflowFilteredTransactions.map((transaction) => {
                    const category = categories.find((item) => item.id === transaction.categoryId);
                    const account = accounts.find((item) => item.id === transaction.accountId);
                    const allocation = allocations.find((item) => item.id === transaction.allocationId);
                    const allocationLabel = allocation?.name || transaction.allocationNameSnapshot;

                    return (
                      <div key={transaction.id} className="flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-11 h-11 rounded-2xl text-white flex items-center justify-center"
                            style={{ backgroundColor: category?.color || '#8E8E93' }}
                          >
                            <CategoryIcon icon={category?.icon} size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{transaction.note}</p>
                            <p className="text-[11px] text-[var(--color-ios-gray)]">
                              {[category?.name, allocationLabel, account?.name, new Date(transaction.date).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </div>
                        </div>
                        <p className={cn(
                          "font-bold text-sm text-right",
                          transaction.type === 'income' ? "text-[var(--color-ios-green)]" : "text-[var(--color-ios-red)]"
                        )}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-6 pt-12 space-y-8"
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                NE
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">Nawfal Elmadany</h2>
                <p className="text-sm text-[var(--color-ios-gray)]">Premium Member</p>
              </div>
            </div>

            <div className="ios-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Kategori Favoritmu</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    {customCategoryCount} kategori kustom siap dipakai saat input transaksi.
                  </p>
                </div>
                <button onClick={openCategoryManager} className="text-[var(--color-ios-blue)] text-sm font-semibold">
                  Kelola
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                {categories.slice(0, 3).map((category) => (
                  <div key={category.id} className="rounded-2xl bg-[#F2F2F7] p-3 space-y-2">
                    <div
                      className="w-10 h-10 rounded-2xl text-white flex items-center justify-center"
                      style={{ backgroundColor: category.color }}
                    >
                      <CategoryIcon icon={category.icon} size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{category.name}</p>
                      <p className="text-[10px] text-[var(--color-ios-gray)]">{CATEGORY_TYPE_LABELS[category.type]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ios-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Alokasi Aktif</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    {customAllocationCount} pos kustom siap mengatur dana sesuai kebutuhan Anda.
                  </p>
                </div>
                <button onClick={() => openAllocationManager()} className="text-[var(--color-ios-blue)] text-sm font-semibold">
                  Kelola
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="rounded-2xl bg-[#F2F2F7] p-3">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Aktif</p>
                  <p className="text-base font-bold mt-2">{allocations.length}</p>
                  <p className="text-[10px] text-[var(--color-ios-gray)] mt-1">pos alokasi</p>
                </div>
                <div className="rounded-2xl bg-[#F2F2F7] p-3">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Saldo bebas</p>
                  <p className="text-sm font-bold mt-2">{formatCurrency(freeBalance)}</p>
                  <p className="text-[10px] text-[var(--color-ios-gray)] mt-1">belum dialokasikan</p>
                </div>
                <div className="rounded-2xl bg-[#F2F2F7] p-3">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Peringatan</p>
                  <p className="text-base font-bold mt-2 text-amber-600">{allocationWarnings.length}</p>
                  <p className="text-[10px] text-[var(--color-ios-gray)] mt-1">butuh perhatian</p>
                </div>
              </div>
            </div>

            <div className="ios-card p-0 overflow-hidden">
              {[
                { icon: ShieldCheck, label: 'Keamanan & PIN', color: 'text-blue-500' },
                { icon: Wallet, label: 'Alokasi Dana', color: 'text-green-500', onClick: () => openAllocationManager() },
                { icon: Tag, label: 'Kategori Kustom', color: 'text-indigo-500', onClick: openCategoryManager },
                { icon: Target, label: 'Target Keuangan', color: 'text-orange-500', onClick: () => openTargetManager() },
                { icon: Bell, label: 'Pengingat Tagihan', color: 'text-red-500' },
                { icon: Settings, label: 'Pengaturan', color: 'text-gray-500' },
                ...(onSignOut
                  ? [{
                      icon: LogOut,
                      label: 'Keluar Akun',
                      color: 'text-red-500',
                      isDanger: true,
                      onClick: () => {
                        if (window.confirm('Yakin ingin keluar dari akun ini?')) {
                          onSignOut();
                        }
                      },
                    }]
                  : []),
              ].map((item, i, items) => (
                <button 
                  key={i}
                  onClick={item.onClick}
                  className={cn(
                    "w-full flex items-center justify-between p-4 active:bg-gray-50 transition-colors",
                    i !== items.length - 1 && "border-b border-gray-100"
                  )}
                >
                  <div className="flex items-center space-x-4">
                    <div className={cn("p-2 rounded-lg bg-opacity-10", item.color.replace('text', 'bg'))}>
                      <item.icon size={20} className={item.color} />
                    </div>
                    <span className={cn("font-semibold text-sm", item.isDanger && "text-red-500")}>{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-300" />
                </button>
              ))}
            </div>

            {/* Debt & Receivables */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Hutang & Piutang</h3>
                <button className="text-[var(--color-ios-blue)] text-sm font-semibold">Tambah</button>
              </div>
              <div className="ios-card p-5 text-center">
                <p className="font-bold">Belum ada data</p>
                <p className="text-sm text-[var(--color-ios-gray)] mt-1">
                  Tambah hutang atau piutang dari tombol Tambah.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAllData}
              className="w-full py-4 text-red-600 font-bold ios-card active:scale-[0.98]"
            >
              Reset Data Aplikasi
            </button>

            <button 
              onClick={() => setIsLocked(true)}
              className="w-full py-4 text-red-500 font-bold ios-card active:scale-[0.98]"
            >
              Kunci Aplikasi
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedHomeTarget && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHomeTargetId('')}
              className="fixed inset-0 bg-black/28 backdrop-blur-md z-[58]"
              aria-label="Tutup detail target"
            />
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', damping: 20, stiffness: 250 }}
              className="fixed top-1/2 -translate-y-1/2 left-4 right-4 z-[59] max-w-md mx-auto rounded-[30px] p-5 space-y-4 border border-white/80 bg-white/72 backdrop-blur-2xl shadow-[0_26px_60px_rgba(15,23,42,0.25)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-[#7A8392] tracking-wider">Detail Target</p>
                  <h4 className="text-xl font-bold mt-1 text-[#111827]">{selectedHomeTarget.name}</h4>
                  <p className="text-[12px] text-[#697385] mt-1">
                    Deadline {formatTargetDeadline(selectedHomeTarget.deadline)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHomeTargetId('')}
                  className="w-9 h-9 rounded-full bg-white/90 border border-[#D7DFEC] text-[#748097] flex items-center justify-center active:scale-95"
                  aria-label="Tutup popup detail target"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-bold text-[#465264]">
                  <span className="text-[#2F7CFF]">
                    {Math.round(
                      Math.min((selectedHomeTarget.currentAmount / selectedHomeTarget.targetAmount) * 100, 100)
                    )}
                    %
                  </span>
                  <span>
                    {formatCurrency(selectedHomeTarget.currentAmount)} / {formatCurrency(selectedHomeTarget.targetAmount)}
                  </span>
                </div>
                <div className="h-2 bg-[#DDE6F3] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((selectedHomeTarget.currentAmount / selectedHomeTarget.targetAmount) * 100, 100)}%`,
                      backgroundColor: getTargetProgressColor(
                        Math.min((selectedHomeTarget.currentAmount / selectedHomeTarget.targetAmount) * 100, 100)
                      ),
                      boxShadow: `0 0 12px ${getTargetProgressColor(
                        Math.min((selectedHomeTarget.currentAmount / selectedHomeTarget.targetAmount) * 100, 100)
                      )}66`,
                    }}
                  />
                </div>
                <p className="text-[12px] text-[#697385]">
                  Sisa dana {formatCurrency(Math.max(selectedHomeTarget.targetAmount - selectedHomeTarget.currentAmount, 0))}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedHomeTarget.id;
                    setSelectedHomeTargetId('');
                    openTargetManager(targetId);
                  }}
                  className="py-3 rounded-2xl bg-[#2F7CFF] text-white font-bold active:scale-95 transition-all shadow-[0_12px_20px_rgba(47,124,255,0.3)]"
                >
                  Setor Dana
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHomeTargetId('')}
                  className="py-3 rounded-2xl bg-white/80 border border-[#D7DFEC] text-[#445065] font-bold active:scale-95 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Transaction Modal (Bottom Sheet) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setSelectedTransactionAllocationId('');
                setTransactionError('');
              }}
              className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[70] p-8 space-y-6 max-w-md mx-auto max-h-[92vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-2" />
              <h2 className="text-xl font-bold text-center">Tambah Transaksi</h2>
              
              <div className="flex bg-[#F2F2F7] p-1 rounded-2xl">
                <button 
                  onClick={() => setNewType('expense')}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold text-sm transition-all",
                    newType === 'expense' ? "bg-white shadow-sm text-black" : "text-[var(--color-ios-gray)]"
                  )}
                >
                  Pengeluaran
                </button>
                <button 
                  onClick={() => setNewType('income')}
                  className={cn(
                    "flex-1 py-2 rounded-xl font-bold text-sm transition-all",
                    newType === 'income' ? "bg-white shadow-sm text-black" : "text-[var(--color-ios-gray)]"
                  )}
                >
                  Pemasukan
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-2">Nominal</label>
                  <input 
                    type="text"
                    inputMode="numeric"
                    value={formatNumericInput(newAmount)}
                    onChange={(e) => {
                      setNewAmount(parseNumericInput(e.target.value));
                      setTransactionError('');
                    }}
                    placeholder="Rp 0" 
                    className="ios-input text-2xl font-bold" 
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase">Kategori</label>
                    <button onClick={openCategoryManager} className="text-[var(--color-ios-blue)] text-xs font-bold">
                      + Kategori Baru
                    </button>
                  </div>
                  {availableCategories.length === 0 ? (
                    <div className="rounded-[var(--radius-ios)] bg-[#F2F2F7] px-4 py-6 text-center text-sm text-[var(--color-ios-gray)]">
                      Belum ada kategori untuk tipe transaksi ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {availableCategories.map(cat => (
                        <button 
                          key={cat.id} 
                          onClick={() => setNewCategory(cat.id)}
                          className={cn(
                            "p-3 rounded-2xl flex flex-col items-center space-y-2 transition-all border",
                            newCategory === cat.id ? "border-transparent text-white shadow-lg" : "border-transparent bg-[#F2F2F7] active:bg-gray-200"
                          )}
                          style={{ backgroundColor: newCategory === cat.id ? cat.color : undefined }}
                        >
                          <CategoryIcon icon={cat.icon} size={18} />
                          <span className="text-[10px] font-bold leading-tight">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase">Sumber Dana</label>
                    <span className="text-[11px] text-[var(--color-ios-gray)]">Pilih akun</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => {
                          setSelectedAccountId(account.id);
                          setTransactionError('');
                        }}
                        className={cn(
                          "rounded-2xl p-3 text-left border transition-all",
                          selectedAccountId === account.id ? "border-[var(--color-ios-blue)] bg-blue-50" : "border-transparent bg-[#F2F2F7]"
                        )}
                      >
                        <p className="text-xs font-bold">{account.name}</p>
                        <p className="text-[10px] text-[var(--color-ios-gray)] mt-1">{formatCurrency(account.balance)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {newType === 'expense' && allocations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                      <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase">Pakai Alokasi</label>
                      <button
                        onClick={() => openAllocationManager()}
                        className="text-[var(--color-ios-blue)] text-xs font-bold"
                      >
                        Kelola Alokasi
                      </button>
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      <button
                        onClick={() => {
                          setSelectedTransactionAllocationId('');
                          setTransactionError('');
                        }}
                        className={cn(
                          "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all",
                          !selectedTransactionAllocationId ? "bg-black text-white" : "bg-[#F2F2F7] text-[var(--color-ios-gray)]"
                        )}
                      >
                        Tanpa alokasi
                      </button>
                      {allocations.map((allocation) => (
                        <button
                          key={allocation.id}
                          onClick={() => {
                            setSelectedTransactionAllocationId(allocation.id);
                            setTransactionError('');
                          }}
                          className={cn(
                            "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all",
                            selectedTransactionAllocationId === allocation.id
                              ? "text-white"
                              : "bg-[#F2F2F7] text-[var(--color-ios-gray)]"
                          )}
                          style={{
                            backgroundColor: selectedTransactionAllocationId === allocation.id ? allocation.color : undefined,
                          }}
                        >
                          {allocation.name}
                        </button>
                      ))}
                    </div>

                    {selectedTransactionAllocation && (
                      <div className="rounded-2xl bg-[#F2F2F7] p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-11 h-11 rounded-2xl text-white flex items-center justify-center"
                            style={{ backgroundColor: selectedTransactionAllocation.color }}
                          >
                            <CategoryIcon icon={selectedTransactionAllocation.icon} size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{selectedTransactionAllocation.name}</p>
                            <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">
                              Sisa alokasi {formatCurrency(selectedTransactionAllocation.currentAmount)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[11px] font-bold",
                            getAllocationStatus(selectedTransactionAllocation).badge
                          )}
                        >
                          {getAllocationStatus(selectedTransactionAllocation).label}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-2">Catatan</label>
                  <input 
                    type="text" 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={newType === 'income' ? 'Contoh: bonus proyek' : 'Beli apa hari ini?'} 
                    className="ios-input" 
                  />
                </div>
              </div>

              {transactionError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{transactionError}</p>}

              <button 
                onClick={handleAddTransaction}
                disabled={!canSubmitTransaction}
                className={cn(
                  "w-full py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all",
                  canSubmitTransaction ? "bg-[var(--color-ios-blue)] shadow-blue-200" : "bg-gray-300 shadow-none cursor-not-allowed"
                )}
              >
                Simpan Transaksi
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCategoryManagerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCategoryManager}
              className="fixed inset-0 bg-black/45 z-[80] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[90] max-w-md mx-auto max-h-[90vh] overflow-y-auto p-8 space-y-6"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />

              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">Kelola Kategori</h2>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    Tambahkan kategori sendiri agar form transaksi lebih fleksibel.
                  </p>
                </div>
                <button onClick={closeCategoryManager} className="p-2 rounded-full bg-[#F2F2F7] text-[var(--color-ios-gray)]">
                  <X size={18} />
                </button>
              </div>

              <div className="ios-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Kategori Tersimpan</h3>
                    <p className="text-xs text-[var(--color-ios-gray)]">Kategori bawaan aman, kategori kustom bisa dihapus jika belum dipakai.</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--color-ios-gray)]">{categories.length} item</span>
                </div>

                <div className="space-y-3">
                  {categories.map((category) => {
                    const isLockedCategory = usedCategoryIds.has(category.id) || !category.isCustom;
                    const hasBudget = category.type !== 'income' && (category.budget ?? 0) > 0;

                    return (
                      <div key={category.id} className="flex items-center justify-between rounded-2xl bg-[#F2F2F7] p-3">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-11 h-11 rounded-2xl text-white flex items-center justify-center"
                            style={{ backgroundColor: category.color }}
                          >
                            <CategoryIcon icon={category.icon} size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{category.name}</p>
                            <p className="text-[11px] text-[var(--color-ios-gray)]">
                              {CATEGORY_TYPE_LABELS[category.type]} - {category.isCustom ? 'Kustom' : 'Bawaan'}
                              {hasBudget ? ` - Budget ${formatCurrency(category.budget ?? 0)}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {hasBudget && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBudgetCategory(category.id, { budgetOnly: true })}
                              className="px-3 py-2 rounded-xl bg-red-50 text-red-500 text-[11px] font-bold active:scale-95 transition-all"
                            >
                              Hapus Budget
                            </button>
                          )}
                          {isLockedCategory ? (
                            <span className="text-[11px] font-bold text-[var(--color-ios-gray)]">
                              {category.isCustom ? 'Dipakai' : 'Bawaan'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDeleteCategory(category.id)}
                              className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center active:scale-95 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ios-card p-5 space-y-5">
                <div>
                  <h3 className="font-bold">Tambah Kategori Baru</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">Pilih nama, tipe, ikon, dan warna favoritmu.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nama Kategori</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Contoh: Nongkrong, Freelance, Kesehatan"
                    className="ios-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Tipe</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['expense', 'income', 'both'] as CategoryType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setCategoryType(type)}
                        className={cn(
                          "rounded-2xl px-3 py-3 text-sm font-bold transition-all",
                          categoryType === type ? "bg-[var(--color-ios-blue)] text-white" : "bg-[#F2F2F7] text-[var(--color-ios-gray)]"
                        )}
                      >
                        {CATEGORY_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                {categoryType !== 'income' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Budget Opsional</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumericInput(categoryBudget)}
                      onChange={(e) => setCategoryBudget(parseNumericInput(e.target.value))}
                      placeholder="Misalnya 500000"
                      className="ios-input"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Ikon</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CATEGORY_ICON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setCategoryIcon(option.value)}
                        className={cn(
                          "rounded-2xl p-3 flex flex-col items-center space-y-2 transition-all border",
                          categoryIcon === option.value ? "border-[var(--color-ios-blue)] bg-blue-50" : "border-transparent bg-[#F2F2F7]"
                        )}
                      >
                        <CategoryIcon icon={option.value} size={18} />
                        <span className="text-[10px] font-bold leading-tight">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Warna</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CATEGORY_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setCategoryColor(color)}
                        className={cn(
                          "h-12 rounded-2xl border-2 transition-all",
                          categoryColor === color ? "border-black scale-95" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: categoryColor }}>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <CategoryIcon icon={categoryIcon} size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{categoryName.trim() || 'Preview Kategori'}</p>
                      <p className="text-xs text-white/80">{CATEGORY_TYPE_LABELS[categoryType]}</p>
                    </div>
                  </div>
                </div>

                {categoryError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{categoryError}</p>}

                <button
                  onClick={handleCreateCategory}
                  className="w-full py-4 bg-[var(--color-ios-blue)] text-white font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all"
                >
                  Simpan Kategori
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTargetManagerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeTargetManager}
              className="fixed inset-0 bg-black/45 z-[95] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[100] max-w-md mx-auto max-h-[90vh] overflow-y-auto p-8 space-y-6"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Target Keuangan</h2>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    Buat target baru dan setor dana langsung dari akun pilihan.
                  </p>
                </div>
                <button onClick={closeTargetManager} className="p-2 rounded-full bg-[#F2F2F7] text-[var(--color-ios-gray)]">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Total</p>
                  <p className="text-lg font-bold mt-1">{targets.length}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">target aktif</p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Tercapai</p>
                  <p className="text-lg font-bold mt-1 text-[var(--color-ios-green)]">{completedTargetsCount}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">target selesai</p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Terkumpul</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(targets.reduce((sum, target) => sum + target.currentAmount, 0))}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">semua target</p>
                </div>
              </div>

              <div className="ios-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Daftar Target</h3>
                    <p className="text-sm text-[var(--color-ios-gray)]">
                      Pilih target untuk melihat progres dan setor dana. Hapus target akan mengembalikan dana ke akun terpilih.
                    </p>
                  </div>
                </div>

                {sortedTargets.length === 0 ? (
                  <div className="rounded-2xl bg-[#F2F2F7] px-4 py-8 text-center">
                    <p className="font-bold">Belum ada target</p>
                    <p className="text-sm text-[var(--color-ios-gray)] mt-1">Isi form di bawah untuk membuat target pertama.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedTargets.map((target, index) => {
                      const progress = Math.min((target.currentAmount / target.targetAmount) * 100, 100);

                      return (
                        <div key={target.id} className="flex items-start gap-3">
                          <button
                            onClick={() => setSelectedTargetId(target.id)}
                            className={cn(
                              "flex-1 text-left rounded-[28px] bg-gradient-to-br p-4 text-white space-y-3 transition-all",
                              TARGET_GRADIENTS[index % TARGET_GRADIENTS.length],
                              selectedTargetId === target.id && "ring-2 ring-offset-2 ring-[var(--color-ios-blue)]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase text-white/70">Target</p>
                                <h4 className="font-bold">{target.name}</h4>
                                <p className="text-[11px] text-white/75 mt-1">Deadline {formatTargetDeadline(target.deadline)}</p>
                              </div>
                              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/20">
                                {progress >= 100 ? 'Selesai' : `${Math.round(progress)}%`}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span>{formatCurrency(target.currentAmount)}</span>
                                <span>{formatCurrency(target.targetAmount)}</span>
                              </div>
                              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${progress}%`,
                                    backgroundColor: getTargetProgressColor(progress),
                                    boxShadow: `0 0 14px ${getTargetProgressColor(progress)}99`,
                                  }}
                                />
                              </div>
                            </div>
                          </button>

                          <button
                            onClick={() => handleDeleteTarget(target.id)}
                            className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center active:scale-95 transition-all"
                            aria-label={`Hapus target ${target.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="ios-card p-5 space-y-4">
                <div>
                  <h3 className="font-bold">Setor ke Target</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">Dana akan dipotong dari akun terpilih dan dicatat sebagai transaksi tabungan.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Pilih Target</label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {targets.map((target) => (
                      <button
                        key={target.id}
                        onClick={() => setSelectedTargetId(target.id)}
                        className={cn(
                          "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all",
                          selectedTargetId === target.id ? "bg-[var(--color-ios-blue)] text-white" : "bg-[#F2F2F7] text-[var(--color-ios-gray)]"
                        )}
                      >
                        {target.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedTarget && (
                  <div className="rounded-2xl bg-[#F2F2F7] p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold">{selectedTarget.name}</p>
                      <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">
                        Sisa target {formatCurrency(Math.max(selectedTarget.targetAmount - selectedTarget.currentAmount, 0))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[var(--color-ios-gray)]">Terkumpul</p>
                      <p className="text-sm font-bold">{formatCurrency(selectedTarget.currentAmount)}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Akun Sumber Dana</label>
                  <div className="grid grid-cols-2 gap-3">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => setSelectedTargetAccountId(account.id)}
                        className={cn(
                          "rounded-2xl p-3 text-left border transition-all",
                          selectedTargetAccountId === account.id ? "border-[var(--color-ios-blue)] bg-blue-50" : "border-transparent bg-[#F2F2F7]"
                        )}
                      >
                        <p className="text-xs font-bold">{account.name}</p>
                        <p className="text-[10px] text-[var(--color-ios-gray)] mt-1">{formatCurrency(account.balance)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nominal Setor</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumericInput(targetTopUpAmount)}
                    onChange={(e) => setTargetTopUpAmount(parseNumericInput(e.target.value))}
                    placeholder="Contoh: 250000"
                    className="ios-input"
                  />
                </div>

                <button
                  onClick={handleTopUpTarget}
                  disabled={!canTopUpTarget}
                  className={cn(
                    "w-full py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all",
                    canTopUpTarget ? "bg-[var(--color-ios-blue)] shadow-blue-200" : "bg-gray-300 shadow-none cursor-not-allowed"
                  )}
                >
                  Setor ke Target
                </button>

                {targetTopUpError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{targetTopUpError}</p>}
              </div>

              <div className="ios-card p-5 space-y-4">
                <div>
                  <h3 className="font-bold">Tambah Target Baru</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">Bikin target baru sesuai rencana keuangan Anda.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nama Target</label>
                  <input
                    type="text"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="Contoh: Umrah, DP rumah, dana darurat"
                    className="ios-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nominal Target</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumericInput(targetAmount)}
                    onChange={(e) => setTargetAmount(parseNumericInput(e.target.value))}
                    placeholder="Contoh: 10000000"
                    className="ios-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Deadline</label>
                  <input
                    type="date"
                    value={targetDeadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setTargetDeadline(e.target.value)}
                    className="ios-input"
                  />
                </div>

                {targetCreateError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{targetCreateError}</p>}

                <button
                  onClick={handleCreateTarget}
                  disabled={!canCreateTarget}
                  className={cn(
                    "w-full py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all",
                    canCreateTarget ? "bg-[var(--color-ios-blue)] shadow-blue-200" : "bg-gray-300 shadow-none cursor-not-allowed"
                  )}
                >
                  Simpan Target
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAllocationManagerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeAllocationManager}
              className="fixed inset-0 bg-black/45 z-[105] backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[110] max-w-md mx-auto max-h-[90vh] overflow-y-auto p-8 space-y-6"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Alokasi Dana</h2>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    Bagi saldo ke beberapa kebutuhan dan pantau mana yang hampir habis.
                  </p>
                </div>
                <button onClick={closeAllocationManager} className="p-2 rounded-full bg-[#F2F2F7] text-[var(--color-ios-gray)]">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Pos</p>
                  <p className="text-lg font-bold mt-1">{allocations.length}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">alokasi aktif</p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Saldo bebas</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(freeBalance)}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">siap dibagi</p>
                </div>
                <div className="ios-card p-4">
                  <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Peringatan</p>
                  <p className="text-lg font-bold mt-1 text-amber-600">{allocationWarnings.length}</p>
                  <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">hampir habis</p>
                </div>
              </div>

              {allocationWarnings.length > 0 && (
                <div className="ios-card p-5 space-y-3 border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">Pos yang Perlu Diisi Lagi</h3>
                      <p className="text-sm text-[var(--color-ios-gray)]">Dana menipis atau sudah habis akan muncul di sini.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {allocationWarnings.map((warning) => (
                      <button
                        key={warning.id}
                        onClick={() => openAllocationDetail(warning.id)}
                        className={cn(
                          "w-full rounded-2xl px-4 py-3 text-left transition-all",
                          warning.severity === 'empty' ? "bg-red-50" : "bg-amber-50"
                        )}
                      >
                        <p
                          className={cn(
                            "text-sm font-bold",
                            warning.severity === 'empty' ? "text-[var(--color-ios-red)]" : "text-amber-700"
                          )}
                        >
                          {warning.title}
                        </p>
                        <p className="text-xs text-[var(--color-ios-gray)] mt-1">{warning.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="ios-card p-5 space-y-4">
              <div>
                <h3 className="font-bold">Daftar Pos Alokasi</h3>
                <p className="text-sm text-[var(--color-ios-gray)]">Ketuk kartu untuk membuka rincian sisa dana dan status posnya.</p>
              </div>

                {allocations.length === 0 ? (
                  <div className="rounded-2xl bg-[#F2F2F7] px-4 py-8 text-center">
                    <p className="font-bold">Belum ada pos alokasi</p>
                    <p className="text-sm text-[var(--color-ios-gray)] mt-1">Tambahkan pos baru di form bawah.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allocations.map((allocation) => {
                      const allocationStatus = getAllocationStatus(allocation);
                      const progress = allocation.targetAmount > 0
                        ? Math.min((allocation.currentAmount / allocation.targetAmount) * 100, 100)
                        : 0;
                      const isExpanded = expandedAllocationId === allocation.id;
                      const thresholdAmount = allocation.targetAmount * (allocation.alertThreshold / 100);
                      const alertBuffer = Math.max(allocation.currentAmount - thresholdAmount, 0);
                      const allocationStats = allocationUsageStats.get(allocation.id) || { spent: 0, count: 0 };

                      return (
                        <div key={allocation.id} className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <button
                              onClick={() => toggleAllocationDetail(allocation.id)}
                              className={cn(
                                "w-full text-left rounded-[28px] p-4 border transition-all",
                                selectedAllocationId === allocation.id ? "border-[var(--color-ios-blue)] bg-blue-50/50" : "border-transparent bg-[#F2F2F7]"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center space-x-3">
                                  <div
                                    className="w-12 h-12 rounded-2xl text-white flex items-center justify-center"
                                    style={{ backgroundColor: allocation.color }}
                                  >
                                    <CategoryIcon icon={allocation.icon} size={20} />
                                  </div>
                                  <div>
                                    <p className="font-bold">{allocation.name}</p>
                                    <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">
                                      {allocation.note || 'Pos dana sesuai kebutuhan Anda.'}
                                    </p>
                                  </div>
                                </div>
                                <span className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold", allocationStatus.badge)}>
                                  {allocationStatus.label}
                                </span>
                              </div>

                              <div className="space-y-2 mt-4">
                                <div className="flex justify-between text-[11px] font-bold">
                                  <span>{formatCurrency(allocation.currentAmount)}</span>
                                  <span>{formatCurrency(allocation.targetAmount)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%`, backgroundColor: allocationStatus.fill }}
                                  />
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[var(--color-ios-gray)]">
                                  {isExpanded ? 'Sembunyikan rincian' : 'Lihat rincian sisa dana'}
                                </span>
                                <ChevronRight
                                  size={16}
                                  className={cn(
                                    "text-[var(--color-ios-gray)] transition-transform duration-300",
                                    isExpanded && "rotate-90"
                                  )}
                                />
                              </div>
                            </button>

                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0, y: -8 }}
                                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                                  exit={{ opacity: 0, height: 0, y: -8 }}
                                  className="overflow-hidden"
                                >
                                  <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ios-gray)]">
                                          Detail Pos Dana
                                        </p>
                                        <h4 className="font-bold text-base mt-1">
                                          Sisa dana tersedia {formatCurrency(allocation.currentAmount)}
                                        </h4>
                                        <p className="text-xs text-[var(--color-ios-gray)] mt-1">
                                          Pos ini akan masuk peringatan saat sisa dana turun di bawah {formatCurrency(thresholdAmount)}.
                                        </p>
                                      </div>
                                      <div className="px-3 py-2 rounded-2xl bg-white text-right shadow-sm">
                                        <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Sisa</p>
                                        <p className="text-sm font-bold">{Math.round(progress)}%</p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="rounded-2xl bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Sisa Dana</p>
                                        <p className="text-sm font-bold mt-2">{formatCurrency(allocation.currentAmount)}</p>
                                      </div>
                                      <div className="rounded-2xl bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Sudah Terpakai</p>
                                        <p className="text-sm font-bold mt-2">{formatCurrency(allocationStats.spent)}</p>
                                      </div>
                                      <div className="rounded-2xl bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Target Pos</p>
                                        <p className="text-sm font-bold mt-2">{formatCurrency(allocation.targetAmount)}</p>
                                      </div>
                                      <div className="rounded-2xl bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase text-[var(--color-ios-gray)]">Alarm Aktif</p>
                                        <p className="text-sm font-bold mt-2">{formatCurrency(thresholdAmount)}</p>
                                      </div>
                                    </div>

                                    <div className="rounded-2xl bg-white p-4 space-y-2">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-bold">Ringkasan Pos</p>
                                        <span className="text-[11px] font-bold text-[var(--color-ios-gray)]">
                                          {allocationStats.count} transaksi
                                        </span>
                                      </div>
                                      <p className="text-xs text-[var(--color-ios-gray)]">
                                        {allocation.currentAmount <= thresholdAmount
                                          ? 'Sisa dana sudah mendekati batas aman. Sebaiknya isi ulang pos ini agar tidak cepat habis.'
                                          : `Pos ini masih punya buffer aman sebesar ${formatCurrency(alertBuffer)} sebelum masuk status peringatan.`}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex flex-col items-center gap-2">
                            <div className="min-w-[52px] rounded-2xl bg-[#F2F2F7] text-[var(--color-ios-gray)] flex items-center justify-center text-[10px] font-bold text-center px-2 py-3">
                              {allocation.isCustom ? 'Kustom' : 'Bawaan'}
                            </div>
                            <button
                              onClick={() => handleDeleteAllocation(allocation.id)}
                              className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center active:scale-95 transition-all"
                              aria-label={`Hapus pos alokasi ${allocation.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="ios-card p-5 space-y-4">
                <div>
                  <h3 className="font-bold">Isi Alokasi</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    Menggunakan saldo bebas, jadi total saldo akun tidak dipindahkan, hanya diberi tujuan.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Pilih Pos</label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {allocations.map((allocation) => (
                      <button
                        key={allocation.id}
                        onClick={() => openAllocationDetail(allocation.id)}
                        className={cn(
                          "shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all",
                          selectedAllocationId === allocation.id ? "text-white" : "bg-[#F2F2F7] text-[var(--color-ios-gray)]"
                        )}
                        style={{ backgroundColor: selectedAllocationId === allocation.id ? allocation.color : undefined }}
                      >
                        {allocation.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedAllocation && (
                  <div className="rounded-2xl bg-[#F2F2F7] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{selectedAllocation.name}</p>
                        <p className="text-[11px] text-[var(--color-ios-gray)] mt-1">
                          Batas peringatan {selectedAllocation.alertThreshold}% dari target.
                        </p>
                      </div>
                      <span className={cn("px-3 py-1.5 rounded-full text-[11px] font-bold", getAllocationStatus(selectedAllocation).badge)}>
                        {getAllocationStatus(selectedAllocation).label}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>Sisa sekarang {formatCurrency(selectedAllocation.currentAmount)}</span>
                      <span>Target {formatCurrency(selectedAllocation.targetAmount)}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nominal Alokasi</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumericInput(allocationTopUpAmount)}
                    onChange={(e) => setAllocationTopUpAmount(parseNumericInput(e.target.value))}
                    placeholder="Contoh: 250000"
                    className="ios-input"
                  />
                </div>

                <div className="rounded-2xl bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase text-[var(--color-ios-blue)]">Saldo Bebas Tersedia</p>
                  <p className="text-sm font-bold text-[var(--color-ios-blue)] mt-1">{formatCurrency(freeBalance)}</p>
                </div>

                <button
                  onClick={handleTopUpAllocation}
                  disabled={!canTopUpAllocation}
                  className={cn(
                    "w-full py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all",
                    canTopUpAllocation ? "bg-[var(--color-ios-blue)] shadow-blue-200" : "bg-gray-300 shadow-none cursor-not-allowed"
                  )}
                >
                  Simpan Alokasi
                </button>

                {allocationTopUpError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{allocationTopUpError}</p>}
              </div>

              <div className="ios-card p-5 space-y-5">
                <div>
                  <h3 className="font-bold">Tambah Pos Baru</h3>
                  <p className="text-sm text-[var(--color-ios-gray)]">
                    Buat pos sendiri seperti dana darurat, nikah, jajan, mudik, atau kebutuhan lain.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Nama Pos</label>
                  <input
                    type="text"
                    value={allocationName}
                    onChange={(e) => setAllocationName(e.target.value)}
                    placeholder="Contoh: Dana darurat, tabungan nikah, jajan"
                    className="ios-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Target Alokasi</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumericInput(allocationTargetAmount)}
                    onChange={(e) => setAllocationTargetAmount(parseNumericInput(e.target.value))}
                    placeholder="Contoh: 1000000"
                    className="ios-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Batas Peringatan (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={allocationThreshold}
                      onChange={(e) => setAllocationThreshold(e.target.value)}
                      placeholder="20"
                      className="ios-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Catatan Opsional</label>
                    <input
                      type="text"
                      value={allocationNote}
                      onChange={(e) => setAllocationNote(e.target.value)}
                      placeholder="Untuk kebutuhan tertentu"
                      className="ios-input"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Ikon</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CATEGORY_ICON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setAllocationIcon(option.value)}
                        className={cn(
                          "rounded-2xl p-3 flex flex-col items-center space-y-2 transition-all border",
                          allocationIcon === option.value ? "border-[var(--color-ios-blue)] bg-blue-50" : "border-transparent bg-[#F2F2F7]"
                        )}
                      >
                        <CategoryIcon icon={option.value} size={18} />
                        <span className="text-[10px] font-bold leading-tight">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-[var(--color-ios-gray)] uppercase ml-1">Warna</label>
                  <div className="grid grid-cols-4 gap-3">
                    {CATEGORY_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setAllocationColor(color)}
                        className={cn(
                          "h-12 rounded-2xl border-2 transition-all",
                          allocationColor === color ? "border-black scale-95" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: allocationColor }}>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <CategoryIcon icon={allocationIcon} size={20} />
                    </div>
                    <div>
                      <p className="font-bold">{allocationName.trim() || 'Preview Pos Alokasi'}</p>
                      <p className="text-xs text-white/80">
                        Target {formatCurrency(Number(allocationTargetAmount) || 0)} • Peringatan {allocationThreshold || 20}%
                      </p>
                    </div>
                  </div>
                </div>

                {allocationError && <p className="text-sm font-medium text-[var(--color-ios-red)]">{allocationError}</p>}

                <button
                  onClick={handleCreateAllocation}
                  disabled={!canCreateAllocation}
                  className={cn(
                    "w-full py-4 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all",
                    canCreateAllocation ? "bg-[var(--color-ios-blue)] shadow-blue-200" : "bg-gray-300 shadow-none cursor-not-allowed"
                  )}
                >
                  Simpan Pos Alokasi
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

