import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  CarFront,
  ClipboardList,
  Package,
  Users,
  Settings2,
  MessageCircle,
  BarChart3,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Coffee,
  Globe2,
  House,
  LayoutGrid,
  Menu,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  Wheat,
  X,
  WifiOff,
} from 'lucide-react';
import { configured } from './api';
import Home from './Home';
import { Empty, HamiyaMark, LoadingState, StartupSplash } from './components';
import { useCompactLayout, useKeyboardViewport, useOverlay } from './experience';
const CatalogPage = lazy(() =>
  import('./Commerce').then((module) => ({ default: module.CatalogPage })),
);
const OrdersPage = lazy(() =>
  import('./Commerce').then((module) => ({ default: module.OrdersPage })),
);
const Cart = lazy(() => import('./Commerce').then((module) => ({ default: module.Cart })));
import { languages } from './i18n';
import { useApp } from './state';
import { appView } from './navigation';
const Account = lazy(() => import('./Account'));
const Settings = lazy(() => import('./Settings'));
const UpdateNotice = lazy(() => import('./UpdateNotice'));
const Admin = lazy(() => import('./Admin'));
const navigation = [
  { route: 'home', label: 'home', icon: House },
  { route: 'catalog', label: 'products', icon: LayoutGrid },
  { route: 'orders', label: 'navOrders', icon: ShoppingBag },
  { route: 'account', label: 'navProfile', icon: UserRound },
];
const nativeSurface = registerPlugin<{ setSurface(options: { dark: boolean }): Promise<void> }>(
  'HamiyaSystemUi',
);
export default function App() {
  const {
    t,
    route,
    navigate,
    user,
    authLoading,
    authError,
    refreshUser,
    language,
    setLanguage,
    cart,
    setCartOpen,
    cartOpen,
    online,
    catalog,
    recovery,
  } = useApp();
  const root = route.split(/[/?]/)[0];
  const headerPageKey =
    root === 'settings'
      ? 'appSettings'
      : root === 'catalog'
        ? 'categories'
        : ['home', 'orders', 'account', 'settings', 'admin', 'help', 'privacy', 'terms'].includes(
              root,
            )
          ? root
          : 'home';
  const view = appView({
    authLoading,
    signedIn: !!user,
    recovery,
    route,
    needsProfile: user?.role === 'customer' && user.verification === 'draft',
  });
  const standalone = view !== 'dashboard';
  const isStaff = !!user && user.role !== 'customer';
  const adminNavigation = [
    { route: 'admin', label: 'overview', icon: BarChart3 },
    { route: 'admin/customers', label: 'customers', icon: Users },
    { route: 'admin/orders', label: 'adminOrders', icon: ClipboardList },
    { route: 'admin/products', label: 'products', icon: Package },
    { route: 'admin/requests', label: 'requests', icon: MessageCircle },
    { route: 'admin/settings', label: 'businessSettings', icon: Settings2 },
  ];
  const [drawer, setDrawer] = useState(false);
  const compact = useCompactLayout();
  const mobileDrawer = drawer && compact && !standalone;
  useOverlay(mobileDrawer, () => setDrawer(false));
  useKeyboardViewport();
  useEffect(() => {
    if (authLoading || authError) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const ready = () => {
      if (cancelled) return;
      if (document.querySelector('.recovery-screen')) return;
      if (document.querySelector('.loading-state')) {
        timer = setTimeout(ready, 100);
        return;
      }
      void import('./native-updates').then((module) => {
        if (!cancelled) module.confirmAppReady();
      });
    };
    timer = setTimeout(ready, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authLoading, authError]);
  useEffect(() => {
    const loading = authLoading || (authError && !user);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', loading ? '#193b4d' : '#f6f8fa');
    if (!Capacitor.isNativePlatform()) return;
    const update = () => {
      void (async () => {
        await SystemBars.show();
        await SystemBars.setStyle({
          style: loading ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        });
        if (Capacitor.isPluginAvailable('HamiyaSystemUi'))
          await nativeSurface.setSurface({ dark: loading });
      })().catch(() => {});
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [authLoading, authError, !!user]);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!compact) setDrawer(false);
  }, [compact]);
  useEffect(() => {
    const title =
      view === 'auth'
        ? root === 'register'
          ? 'register'
          : root === 'forgot'
            ? 'resetPassword'
            : 'signIn'
        : view === 'onboarding'
          ? 'profile'
          : headerPageKey;
    document.title = `${t(title)} · HAMIYA`;
  }, [headerPageKey, root, t, view]);
  useEffect(() => {
    if (
      isStaff &&
      view === 'dashboard' &&
      root !== 'admin' &&
      root !== 'account' &&
      root !== 'settings'
    ) {
      navigate('admin');
    }
  }, [isStaff, view, root, navigate]);
  useEffect(() => {
    if (standalone) {
      setDrawer(false);
      setCartOpen(false);
    }
  }, [standalone, setCartOpen]);
  useEffect(() => {
    if (!mobileDrawer) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false);
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>('button, a, select') || [],
      ).filter((element) => element.offsetParent !== null);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [mobileDrawer]);
  function go(value: string) {
    navigate(value);
    setDrawer(false);
  }
  if (authError && !user)
    return <StartupSplash failed onRetry={() => void refreshUser().catch(() => {})} />;
  if (view === 'loading') return <StartupSplash />;
  if (standalone)
    return (
      <div className={'entry-screen entry-' + view}>
        {view === 'information' && (
          <header className="entry-header">
            <button
              className="entry-back"
              onClick={() => navigate(user || recovery ? 'account' : 'signin')}
            >
              <ArrowLeft size={18} />
              {t(user ? 'account' : 'backToSignIn')}
            </button>
            <label className="language-select">
              <Globe2 size={16} />
              <select
                aria-label={t('language')}
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </header>
        )}
        {!online && (
          <div className="entry-offline" role="status">
            <WifiOff size={16} />
            {t('offline')}
          </div>
        )}
        <main id="main" className="entry-main" tabIndex={-1}>
          {view === 'information' ? (
            root === 'settings' ? (
              <Suspense fallback={<LoadingState />}>
                <Settings />
              </Suspense>
            ) : (
              <Information page={root} />
            )
          ) : (
            <Suspense fallback={<LoadingState />}>
              <Account key={user?.id || 'guest'} />
            </Suspense>
          )}
        </main>
      </div>
    );
  return (
    <div className={(isStaff ? 'app admin-app-shell' : 'app') + ' route-' + root}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('continue')}
      </a>
      <aside
        ref={drawerRef}
        id="app-drawer"
        className={'sidebar ' + (mobileDrawer ? 'open' : '')}
        role={mobileDrawer ? 'dialog' : undefined}
        aria-modal={mobileDrawer || undefined}
        aria-label={t('navigation')}
        inert={compact && !mobileDrawer}
      >
        <div className="sidebar-brand">
          <button
            className="brand"
            aria-label="Hamiya"
            onClick={() => go(isStaff ? 'admin' : 'home')}
          >
            <HamiyaMark size="sm" />
            <span className="brand-name">
              HAMIYA<small>{t('groupName')}</small>
            </span>
          </button>
          <button
            className="icon-button mobile-only"
            aria-label={t('close')}
            onClick={() => setDrawer(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-divider" />
        <nav aria-label={t('home')}>
          {(isStaff
            ? adminNavigation.filter(
                (item) =>
                  user?.role === 'admin' ||
                  (user?.role === 'reviewer'
                    ? ['admin', 'admin/customers'].includes(item.route)
                    : !['admin/customers', 'admin/settings'].includes(item.route)),
              )
            : navigation
          ).map(({ route: destination, label, icon: Icon }) => (
            <button
              key={destination}
              className={
                'nav-link ' +
                ((isStaff ? route === destination : root === destination) ? 'active' : '')
              }
              aria-current={
                (isStaff ? route === destination : root === destination) ? 'page' : undefined
              }
              onClick={() => go(destination)}
            >
              <Icon size={19} strokeWidth={1.7} />
              {t(label)}
              {root === destination && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        {!isStaff && <div className="sidebar-section-label">{t('family')}</div>}
        {!isStaff && (
          <div className="sidebar-businesses">
            {(
              [
                { key: 'food', icon: Wheat },
                { key: 'coffee', icon: Coffee },
                { key: 'vehicles', icon: CarFront },
              ] as const
            ).map(({ key, icon: Icon }) => (
              <button key={key} onClick={() => go('catalog/' + key)}>
                <span className={'business-dot ' + key}>
                  <Icon size={15} />
                </span>
                <span>{t(key + 'Brand')}</span>
                <ChevronRight size={13} />
              </button>
            ))}
          </div>
        )}
        <div className="sidebar-bottom">
          <button
            className={'nav-link ' + (root === 'settings' ? 'active' : '')}
            aria-current={root === 'settings' ? 'page' : undefined}
            onClick={() => go('settings')}
          >
            <Settings2 size={19} />
            {t('appSettings')}
          </button>
          {isStaff && (
            <button
              className={'nav-link ' + (root === 'account' ? 'active' : '')}
              onClick={() => go('account')}
            >
              <UserRound size={19} />
              {t('account')}
            </button>
          )}
          <button className="nav-link" onClick={() => go('help')}>
            <CircleHelp size={19} />
            {t('help')}
          </button>
          <div className="sidebar-note">
            <ShieldCheck size={19} />
            <span>{t('businessHomeText')}</span>
          </div>
          <div className="sidebar-copyright">© {new Date().getFullYear()} Hamiya</div>
        </div>
      </aside>
      {mobileDrawer && (
        <button
          className="drawer-backdrop"
          aria-label={t('close')}
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="app-body" inert={mobileDrawer}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              aria-label={t('openMenu')}
              aria-expanded={mobileDrawer}
              aria-controls="app-drawer"
              onClick={() => setDrawer(true)}
            >
              <Menu size={23} />
            </button>
            <div className="topbar-context">
              <div className="topbar-context-copy">
                <span>{t(isStaff ? 'workspace' : 'customerPortal')}</span>
                <strong>{t(headerPageKey)}</strong>
              </div>
            </div>
            <button
              className="mobile-wordmark"
              onClick={() => navigate(isStaff ? 'admin' : 'home')}
              aria-label="HAMIYA"
            >
              <HamiyaMark size="tiny" />
              <span className="mobile-wordmark-copy">
                <strong>HAMIYA</strong>
                <small>{t('nativeBrand')}</small>
              </span>
            </button>
          </div>
          <div className="topbar-actions">
            <span className={'connection-pill ' + (online ? 'online' : 'offline')}>
              <span aria-hidden="true" />
              {online ? t('connected') : t('offlineShort')}
            </span>
            <label className="language-select topbar-language">
              <Globe2 size={16} />
              <select
                aria-label={t('language')}
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="topbar-separator" />
            {!isStaff && (
              <button
                className="icon-button cart-button"
                aria-label={t('cart')}
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag size={21} />
                {cart.length > 0 && (
                  <span className="cart-count">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
                )}
              </button>
            )}
            <button
              className="topbar-user"
              onClick={() => navigate('account')}
              aria-label={t('account')}
            >
              <span className="topbar-user-avatar">
                {user ? (
                  user.profile.full_name?.slice(0, 1).toUpperCase() || 'H'
                ) : (
                  <UserRound size={19} />
                )}
              </span>
              <span className="topbar-user-copy">
                <small>{t('account')}</small>
                <strong>{user?.profile.full_name?.split(' ')[0] || 'Hamiya'}</strong>
              </span>
              <ChevronDown className="topbar-user-chevron" size={15} />
            </button>
          </div>
        </header>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={16} />
            {t('offline')}
          </div>
        )}
        {!isStaff && Capacitor.isNativePlatform() && (
          <Suspense fallback={null}>
            <UpdateNotice />
          </Suspense>
        )}
        {!isStaff && catalog.settings.announcement[language] && (
          <div className="announcement-bar">{catalog.settings.announcement[language]}</div>
        )}
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<LoadingState />}>
            {isStaff && root === 'admin' ? (
              <Admin />
            ) : root === 'home' ? (
              <Home />
            ) : root === 'catalog' ? (
              <CatalogPage />
            ) : root === 'orders' ? (
              <OrdersPage />
            ) : root === 'account' ? (
              <Account key={user?.id || 'guest'} />
            ) : root === 'settings' ? (
              <Settings />
            ) : root === 'admin' ? (
              <Admin />
            ) : ['help', 'privacy', 'terms'].includes(root) ? (
              root === 'settings' ? (
                <Suspense fallback={<LoadingState />}>
                  <Settings />
                </Suspense>
              ) : (
                <Information page={root} />
              )
            ) : (
              <Home />
            )}
          </Suspense>
        </main>
        <footer className="site-footer">
          <span>{t('groupName')}</span>
          <div>
            <button onClick={() => navigate('privacy')}>{t('privacy')}</button>
            <button onClick={() => navigate('terms')}>{t('terms')}</button>
            <button onClick={() => navigate('help')}>{t('help')}</button>
          </div>
        </footer>
      </div>
      {!isStaff && (
        <nav className="mobile-nav" aria-label={t('navigation')} inert={mobileDrawer}>
          {navigation.map(({ route: destination, label, icon: Icon }) => (
            <button
              key={destination}
              className={root === destination ? 'active' : ''}
              aria-current={root === destination ? 'page' : undefined}
              onClick={() => go(destination)}
            >
              <Icon size={23} strokeWidth={root === destination ? 2.3 : 1.8} aria-hidden="true" />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
      )}
      {!isStaff && cartOpen && (
        <Suspense fallback={null}>
          <Cart />
        </Suspense>
      )}
    </div>
  );
}
function Information({ page }: { page: string }) {
  const { t, catalog, navigate } = useApp();
  const settings = catalog.settings;
  return (
    <section className="information-page">
      <span className="round-icon">{page === 'help' ? <CircleHelp /> : <ShieldCheck />}</span>
      <span className="eyebrow">HAMIYA FOOD PROCESSING</span>
      <h1>{t(page)}</h1>
      <p className="information-intro">{t(page === 'help' ? 'supportText' : page + 'Text')}</p>
      {page === 'help' && (
        <div className="panel contact-list">
          {settings.contact_phone && (
            <a href={'tel:' + settings.contact_phone}>
              {settings.contact_phone}
              <ArrowUpRight size={18} />
            </a>
          )}
          {settings.contact_email && (
            <a href={'mailto:' + settings.contact_email}>
              {settings.contact_email}
              <ArrowUpRight size={18} />
            </a>
          )}
          {settings.pickup_address && <p>{settings.pickup_address}</p>}
          {!settings.contact_phone && !settings.contact_email && (
            <Empty title={t('contactPending')} />
          )}
        </div>
      )}
      {page !== 'help' && (
        <button className="button secondary" onClick={() => navigate('account')}>
          {t('account')}
          <ArrowRight size={17} />
        </button>
      )}
      {!configured && <div className="notice">{t('servicePending')}</div>}
    </section>
  );
}
