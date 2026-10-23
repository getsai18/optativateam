import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { configureLocale } from '../lib/format';
import { localStore } from '../lib/storage';
import { appDict } from './dict/app';
import { auditDict } from './dict/audit';
import { catalogDict } from './dict/catalog';
import { commonDict } from './dict/common';
import { customersDict } from './dict/customers';
import { dashboardDict } from './dict/dashboard';
import { invoicesDict } from './dict/invoices';
import { paymentsDict } from './dict/payments';
import { taxesDict } from './dict/taxes';
import { usersDict } from './dict/users';

export type Lang = 'es' | 'en';
export type Dict = Record<string, string>;
export type DictPair = { es: Dict; en: Dict };

const NAMESPACE: Record<string, DictPair> = {
  common: commonDict,
  app: appDict,
  invoices: invoicesDict,
  customers: customersDict,
  users: usersDict,
  payments: paymentsDict,
  catalog: catalogDict,
  taxes: taxesDict,
  dashboard: dashboardDict,
  audit: auditDict,
};

const STORAGE_KEY = 'nw.lang';

export function readLang(): Lang {
  const saved = localStore.get<Lang>(STORAGE_KEY);
  return saved === 'en' || saved === 'es' ? saved : 'es';
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dot = key.indexOf('.');
  const ns = dot > 0 ? key.slice(0, dot) : '';
  const rest = dot > 0 ? key.slice(dot + 1) : key;
  // 1) Namespaced keys: invoices.list.title -> invoices dict, "list.title".
  let text = NAMESPACE[ns]?.[lang]?.[rest];
  // 2) Flat keys that live in the app shell dict (nav.*, crumb.*, login.*, …) or in common.
  if (text === undefined) text = NAMESPACE.app?.[lang]?.[key];
  if (text === undefined) text = NAMESPACE.common?.[lang]?.[key];
  if (text === undefined) text = key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;
export type TnFn = (key: string, n: number, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
  tn: TnFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    configureLocale(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    localStore.set(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tn: (key, n, vars) => translate(lang, `${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars }),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
