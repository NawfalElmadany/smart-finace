import type { Account, Allocation, Category, Target, Transaction } from '../types';
import { supabase } from './supabase';

const DEVICE_ID_STORAGE_KEY = 'sf_device_id';
const SUPABASE_STATE_TABLE = import.meta.env.VITE_SUPABASE_STATE_TABLE || 'finance_state';

export interface FinanceSnapshot {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  targets: Target[];
  allocations: Allocation[];
  updatedAt?: string;
}

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getDeviceId = () => {
  const existingDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const newDeviceId = createDeviceId();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);
  return newDeviceId;
};

export const loadSnapshotFromCloud = async (userId: string): Promise<FinanceSnapshot | null> => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(SUPABASE_STATE_TABLE)
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Supabase load skipped:', error.message);
    return null;
  }

  const row = data as { payload?: FinanceSnapshot; updated_at?: string } | null;
  if (!row?.payload) {
    return null;
  }

  return {
    ...row.payload,
    updatedAt: row.updated_at || row.payload.updatedAt,
  };
};

export const saveSnapshotToCloud = async (
  userId: string,
  deviceId: string,
  snapshot: FinanceSnapshot,
): Promise<void> => {
  if (!supabase) {
    return;
  }

  const updatedAt = new Date().toISOString();
  const payload: FinanceSnapshot = {
    ...snapshot,
    updatedAt,
  };

  const { error } = await supabase.from(SUPABASE_STATE_TABLE).upsert(
    {
      user_id: userId,
      device_id: deviceId,
      last_device_id: deviceId,
      payload,
      updated_at: updatedAt,
    },
    {
      onConflict: 'user_id',
    },
  );

  if (error) {
    console.warn('Supabase save skipped:', error.message);
  }
};
