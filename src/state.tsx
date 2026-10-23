import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppError, configured, currentProfile, loadCatalog, rpc, supabase } from './api';
import { languages, translate, type Language } from './i18n';
import type { CartItem, Catalog, Customer, Product } from './types';
const initialCatalog: Catalog = {
  products: [],
  settings: {
    pickup: true,
    delivery: false,
    delivery_fee_cents: null,
    contact_phone: '',
    contact_email: '',
    pickup_address: '',
    announcement: { en: '', am: '', om: '' },
  },
};
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing or a full disk must not break the app. */
  }
}
function getRoute() {
  return window.location.hash.slice(1) || 'home';
}
interface AppContextValue {
  language: Language;
  t: (key: string) => string;
  setLanguage: (language: Language) => void;
  user: Customer | null;
  authLoading: boolean;
  setUser: (user: Customer | null) => void;
  refreshUser: () => Promise<void>;
  catalog: Catalog;
  refreshCatalog: () => Promise<void>;
  catalogLoading: boolean;
  catalogError: string;
  cached: boolean;
  route: string;
  navigate: (route: string) => void;
  online: boolean;
  cart: CartItem[];
  setCart: (items: CartItem[]) => void;
  addCart: (p: Product, quantity: number) => void;
  toast: (message: string) => void;
  notifyError: (error: unknown) => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  recovery: boolean;
  setRecovery: (value: boolean) => void;
}
const Context = createContext<AppContextValue | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const value = stored('hamiya-language', 'en');
    return languages.some((l) => l.code === value) ? (value as Language) : 'en';
  });
  const [user, setUser] = useState<Customer | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [catalog, setCatalog] = useState<Catalog>(() =>
    stored('hamiya-catalog-v1', initialCatalog),
  );
  const [catalogLoading, setCatalogLoading] = useState(configured);
  const [catalogError, setCatalogError] = useState('');
  const [cached, setCached] = useState(true);
  const [route, setRoute] = useState(getRoute);
  const [online, setOnline] = useState(navigator.onLine);
  const [cart, updateCart] = useState<CartItem[]>(() => {
    const value = stored<unknown>('hamiya-cart-v1', []);
    return Array.isArray(value)
      ? value.filter(
          (x): x is CartItem =>
            !!x &&
            typeof x === 'object' &&
            'id' in x &&
            typeof x.id === 'string' &&
            'quantity' in x &&
            Number.isInteger(x.quantity) &&
            Number(x.quantity) > 0,
        )
      : [];
  });
  const [message, setMessage] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [recovery, setRecovery] = useState(window.location.hash.includes('type=recovery'));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const languageRef = useRef(language);
  languageRef.current = language;
  const t = useCallback((key: string) => translate(language, key), [language]);
  const toast = useCallback((message: string) => {
    setMessage(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 6000);
  }, []);
  const notifyError = useCallback(
    (error: unknown) =>
      toast(
        translate(languageRef.current, error instanceof AppError ? error.code : 'connectionError'),
      ),
    [toast],
  );
  const navigate = useCallback((next: string) => {
    history.pushState(null, '', '#' + next);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const refreshUser = useCallback(async () => {
    try {
      const { user } = await currentProfile();
      setUser(user);
    } finally {
      setAuthLoading(false);
    }
  }, []);
  const refreshCatalog = useCallback(async () => {
    try {
      const data = await loadCatalog();
      setCatalog(data);
      persist('hamiya-catalog-v1', data);
      setCached(false);
      setCatalogError('');
    } catch (error) {
      setCatalogError(error instanceof AppError ? error.code : 'connectionError');
      setCached(true);
    } finally {
      setCatalogLoading(false);
    }
  }, []);
  function setLanguage(next: Language) {
    setLang(next);
    persist('hamiya-language', next);
    if (user && online) {
      void rpc('preferences', { language: next }).catch(notifyError);
      void supabase?.auth.updateUser({ data: { language: next } });
    }
  }
  function setCart(items: CartItem[]) {
    updateCart(items);
    persist('hamiya-cart-v1', items);
  }
  function addCart(p: Product, quantity: number) {
    if (!p.confirmed || !p.price_cents || !['available', 'low_stock'].includes(p.status)) return;
    const existing = cart.find((x) => x.id === p.id);
    const amount = Math.min((existing?.quantity || 0) + quantity, p.available_quantity);
    setCart([
      ...cart.filter((x) => x.id !== p.id),
      {
        id: p.id,
        name: p.name,
        quantity: amount,
        price_cents: p.price_cents,
        sales_unit: p.sales_unit,
      },
    ]);
    toast(t('addedCart'));
  }
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const client = supabase;
    if (!user?.id || !client) return;
    const channel = client
      .channel('hamiya-profile-' + user.id)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hamiya_profiles', filter: `id=eq.${user.id}` },
        () => void refreshUser().catch(notifyError),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [user?.id, refreshUser, notifyError]);
  useEffect(() => {
    void refreshCatalog();
    void refreshUser().catch(notifyError);
    const onRoute = () => setRoute(getRoute());
    const onOnline = () => {
      setOnline(true);
      void refreshCatalog();
      void refreshUser().catch(notifyError);
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshCatalog();
        void refreshUser().catch(notifyError);
      }
    };
    window.addEventListener('popstate', onRoute);
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const auth = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setRoute('account');
      }
      if (!session) setUser(null);
      else
        setTimeout(() => {
          void refreshUser().catch(notifyError);
        }, 0);
    });
    const channel = supabase
      ?.channel('hamiya-public-catalog')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hamiya_catalog_events' },
        () => void refreshCatalog(),
      )
      .subscribe();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refreshCatalog();
    }, 60000);
    return () => {
      window.removeEventListener('popstate', onRoute);
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      auth?.data.subscription.unsubscribe();
      if (channel) void supabase?.removeChannel(channel);
      clearInterval(interval);
      clearTimeout(timer.current);
    };
  }, [refreshCatalog, refreshUser, notifyError]);
  return (
    <Context.Provider
      value={{
        language,
        t,
        setLanguage,
        user,
        authLoading,
        setUser,
        refreshUser,
        catalog,
        refreshCatalog,
        catalogLoading,
        catalogError,
        cached,
        route,
        navigate,
        online,
        cart,
        setCart,
        addCart,
        toast,
        notifyError,
        cartOpen,
        setCartOpen,
        recovery,
        setRecovery,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label={t('close')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('Provider required');
  return value;
}
