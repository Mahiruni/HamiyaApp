import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CarFront,
  ClipboardList,
  Package,
  Users,
  Settings2,
  MessageCircle,
  BarChart3,
  ChevronRight,
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
import { Badge, BrandMark, Empty, LanguageSelector } from './components';
import { Cart, CatalogPage, OrdersPage } from './Commerce';
import { useApp } from './state';
import { appView } from './navigation';
const Account = lazy(() => import('./Account'));
const Admin = lazy(() => import('./Admin'));
const navigation = [
  { route: 'home', label: 'home', icon: House },
  { route: 'catalog', label: 'categories', icon: LayoutGrid },
  { route: 'orders', label: 'orders', icon: ShoppingBag },
  { route: 'account', label: 'account', icon: UserRound },
];
export default function App() {
  const {
    t,
    route,
    navigate,
    user,
    authLoading,
    language,
    cart,
    setCartOpen,
    cartOpen,
    online,
    catalog,
    recovery,
  } = useApp();
  const root = route.split('/')[0];
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
    { route: 'admin', label: 'Command center', icon: BarChart3 },
    { route: 'admin/customers', label: 'Customer verification', icon: Users },
    { route: 'admin/orders', label: 'Orders', icon: ClipboardList },
    { route: 'admin/products', label: 'Inventory', icon: Package },
    { route: 'admin/requests', label: 'Enquiries', icon: MessageCircle },
    { route: 'admin/settings', label: 'Settings', icon: Settings2 },
  ];
  const [drawer, setDrawer] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => setDrawer(false), [route]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setDrawer(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    if (isStaff && view === 'dashboard' && root !== 'admin' && root !== 'account') {
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
    if (!drawer || standalone) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLButtonElement>('.menu-close')?.focus();
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
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [drawer, standalone]);
  function go(value: string) {
    navigate(value);
    setDrawer(false);
  }
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
            <LanguageSelector />
          </header>
        )}
        {!online && (
          <div className="entry-offline" role="status">
            <WifiOff size={16} />
            {t('offline')}
          </div>
        )}
        <main id="main" className="entry-main" tabIndex={-1}>
          {view === 'loading' ? (
            <EntryLoading />
          ) : view === 'information' ? (
            <Information page={root} />
          ) : (
            <Suspense fallback={<EntryLoading />}>
              <Account key={user?.id || 'guest'} />
            </Suspense>
          )}
        </main>
      </div>
    );
  return (
    <div className={isStaff ? 'app admin-app-shell' : 'app'}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('skipContent')}
      </a>
      <aside
        id="app-menu"
        ref={drawerRef}
        className={'sidebar ' + (drawer ? 'open' : '')}
        aria-label={t('menu')}
        role={drawer ? 'dialog' : undefined}
        aria-modal={drawer ? true : undefined}
      >
        <div className="sidebar-brand">
          <button
            className="brand"
            aria-label="Hamiya"
            onClick={() => go(isStaff ? 'admin' : 'home')}
          >
            <BrandMark />
            <span className="brand-name">
              hamiya<small>INVESTMENT GROUP</small>
            </span>
          </button>
          <button
            className="icon-button menu-close mobile-only"
            aria-label={t('close')}
            onClick={() => setDrawer(false)}
          >
            <X size={21} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-divider" />
        {user && (
          <button className="menu-account" onClick={() => go('account')} aria-label={t('account')}>
            <span className="menu-avatar">{user.profile.full_name?.slice(0, 1) || 'H'}</span>
            <span className="menu-account-details">
              <strong>
                {user.profile.full_name || user.profile.business_name || t('account')}
              </strong>
              <small>{t('profile')}</small>
            </span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        )}
        <nav aria-label={t('home')}>
          {(isStaff ? adminNavigation : navigation).map(
            ({ route: destination, label, icon: Icon }) => (
              <button
                key={destination}
                aria-current={
                  (isStaff ? route === destination : root === destination) ? 'page' : undefined
                }
                className={
                  'nav-link ' +
                  ((isStaff ? route === destination : root === destination) ? 'active' : '')
                }
                onClick={() => go(destination)}
              >
                <Icon size={19} strokeWidth={1.7} />
                {isStaff ? label : t(label)}
                {(isStaff ? route === destination : root === destination) && (
                  <span className="nav-active-dot" />
                )}
              </button>
            ),
          )}
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
              <button
                key={key}
                aria-current={route === 'catalog/' + key ? 'page' : undefined}
                onClick={() => go('catalog/' + key)}
              >
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
          {user && user.role !== 'customer' && (
            <button
              className={'nav-link ' + (root === 'admin' ? 'active' : '')}
              onClick={() => go('admin')}
            >
              <Building2 size={19} />
              {t('admin')}
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
      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label={t('close')}
          onClick={() => setDrawer(false)}
        />
      )}
      <div className="app-body" inert={drawer}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle mobile-only"
              aria-label={t('openMenu')}
              aria-expanded={drawer}
              aria-controls="app-menu"
              aria-haspopup="dialog"
              onClick={() => setDrawer(true)}
            >
              <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div className="breadcrumb">
              <span>Hamiya</span>
              <ChevronRight size={13} />
              <strong>
                {t(
                  root === 'catalog'
                    ? 'categories'
                    : ['home', 'orders', 'account', 'admin', 'help', 'privacy', 'terms'].includes(
                          root,
                        )
                      ? root
                      : 'home',
                )}
              </strong>
            </div>
            <button
              className="mobile-wordmark"
              onClick={() => navigate(isStaff ? 'admin' : 'home')}
            >
              <BrandMark /> hamiya
            </button>
          </div>
          <div className="topbar-actions">
            <LanguageSelector />
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
              {user ? (
                <span>{user.profile.full_name?.slice(0, 1) || 'H'}</span>
              ) : (
                <UserRound size={20} />
              )}
            </button>
          </div>
        </header>
        {!online && (
          <div className="offline-banner">
            <WifiOff size={16} />
            {t('offline')}
          </div>
        )}
        {!isStaff && catalog.settings.announcement[language] && (
          <div className="announcement-bar">{catalog.settings.announcement[language]}</div>
        )}
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<div className="loading-row">{t('loading')}</div>}>
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
            ) : root === 'admin' ? (
              <Admin />
            ) : ['help', 'privacy', 'terms'].includes(root) ? (
              <Information page={root} />
            ) : (
              <Home />
            )}
          </Suspense>
        </main>
        <footer className="site-footer">
          <span>Hamiya Investment Group</span>
          <div>
            <button onClick={() => navigate('privacy')}>{t('privacy')}</button>
            <button onClick={() => navigate('terms')}>{t('terms')}</button>
            <button onClick={() => navigate('help')}>{t('help')}</button>
          </div>
        </footer>
      </div>
      {!isStaff && (
        <nav className="mobile-nav" aria-label={t('categories')} inert={drawer}>
          {navigation.map(({ route: destination, label, icon: Icon }) => (
            <button
              key={destination}
              aria-current={root === destination ? 'page' : undefined}
              className={root === destination ? 'active' : ''}
              onClick={() => go(destination)}
            >
              <Icon size={21} strokeWidth={root === destination ? 2 : 1.7} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
      )}
      {!isStaff && cartOpen && <Cart />}
    </div>
  );
}
function EntryLoading() {
  const { t } = useApp();
  return (
    <div className="entry-loading" role="status">
      <BrandMark />
      <strong>hamiya</strong>
      <span>{t('loading')}</span>
    </div>
  );
}
function Home() {
  const { t, navigate, user, catalog, cart, catalogLoading, catalogError } = useApp();
  const published = catalog.products.filter((product) => product.published);
  const available = published.filter(
    (product) =>
      product.available_quantity > 0 && ['available', 'low_stock'].includes(product.status),
  );
  const divisions = [
    { id: 'food', icon: Wheat },
    { id: 'coffee', icon: Coffee },
    { id: 'vehicles', icon: CarFront },
  ] as const;
  const metrics = [
    { label: 'businessDivisions', value: '03' },
    { label: 'listedProducts', value: published.length },
    { label: 'inStockNow', value: available.length },
    { label: 'cartItems', value: cart.reduce((sum, item) => sum + item.quantity, 0) },
  ];
  const shortcuts = [
    { route: 'orders', title: 'orders', text: 'ordersShortcut', icon: ClipboardList },
    { route: 'account', title: 'profile', text: 'profileShortcut', icon: UserRound },
    { route: 'help', title: 'help', text: 'supportShortcut', icon: CircleHelp },
  ];
  return (
    <div className="home-page">
      <section className="hamiya-dashboard" aria-label={t('home')}>
        <div className="hamiya-dash-head">
          <div className="hamiya-dash-heading">
            <span className="hamiya-dash-kicker">
              <span className="hamiya-live-dot" />
              {t('customerPortal')}
            </span>
            <h1>
              {t(user ? 'welcomeBack' : 'welcome')}
              {user?.profile.full_name ? `, ${user.profile.full_name.split(' ')[0]}.` : '.'}
            </h1>
            <p>{t('businessHomeText')}</p>
          </div>
          <span className="hamiya-dash-date">
            <Globe2 size={16} />
            {t('country')}
            <span>·</span>ETB
          </span>
        </div>
        <div className="hamiya-dash-grid">
          <div className="hamiya-dash-main">
            <div className="hamiya-dash-main-top">
              <span className="hamiya-dash-overline">{t('eyebrow')}</span>
              <BrandMark />
            </div>
            <h2>
              {t('heroTitle')}
              <br />
              <em>{t('heroAccent')}</em>
            </h2>
            <p>{t('heroText')}</p>
            <div className="hamiya-dash-actions">
              <button className="hamiya-dash-action-primary" onClick={() => navigate('catalog')}>
                {t('explore')}
                <ArrowUpRight size={18} />
              </button>
              <button
                className="hamiya-dash-action-secondary"
                onClick={() => navigate(user ? 'orders' : 'account')}
              >
                {t(user ? 'orders' : 'createAccount')}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="hamiya-dash-main-bottom">
              <span>HAMIYA INVESTMENT GROUP</span>
              <span>{t('country')} · ETB</span>
            </div>
          </div>
          <div className="hamiya-dash-side">
            <div className="hamiya-dash-side-label">
              <span>{t('atGlance')}</span>
              <LayoutGrid size={17} />
            </div>
            <div className="hamiya-dash-metrics" aria-busy={catalogLoading}>
              {metrics.map(({ label, value }) => (
                <div key={label}>
                  <strong>
                    {catalogLoading && ['listedProducts', 'inStockNow'].includes(label)
                      ? '—'
                      : value}
                  </strong>
                  <span>{t(label)}</span>
                </div>
              ))}
            </div>
            {catalogError && (
              <p className="dashboard-data-note" role="status">
                {t('cached')}
              </p>
            )}
            <button className="hamiya-dash-status" onClick={() => navigate('account')}>
              <ShieldCheck size={21} />
              <span>
                <strong>{t('profile')}</strong>
                {user ? <Badge status={user.verification} /> : <small>{t('createAccount')}</small>}
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="hamiya-dash-section-heading">
          <div>
            <span className="hamiya-dash-overline">{t('family')}</span>
            <h2>{t('ourBusinesses')}</h2>
          </div>
          <button onClick={() => navigate('catalog')}>
            {t('viewAll')}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="hamiya-division-grid">
          {divisions.map(({ id, icon: Icon }, index) => (
            <button
              className={'hamiya-division division-' + id}
              key={id}
              onClick={() => navigate('catalog/' + id)}
            >
              <div className="hamiya-division-top">
                <span className="hamiya-division-icon">
                  <Icon size={25} strokeWidth={1.6} />
                </span>
                <span className="hamiya-division-index">0{index + 1}</span>
              </div>
              <span className="division-art" aria-hidden="true">
                <Icon strokeWidth={0.65} />
              </span>
              <strong>{t(id + 'Brand')}</strong>
              <small>{t(id + 'Desc')}</small>
              <span className="hamiya-division-bottom">
                {t(id)}
                <ArrowUpRight size={18} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="customer-shortcuts" aria-label={t('workspace')}>
        {shortcuts.map(({ route, title, text, icon: Icon }) => (
          <button key={route} onClick={() => navigate(route)}>
            <span className="shortcut-icon">
              <Icon size={21} strokeWidth={1.7} />
            </span>
            <span>
              <strong>{t(title)}</strong>
              <small>{t(text)}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </section>
      <section className="how-section">
        <div className="section-heading">
          <div>
            <h2>{t('howWorks')}</h2>
            <p>{t('howIntro')}</p>
          </div>
          <ShieldCheck size={26} strokeWidth={1.2} />
        </div>
        <div className="how-grid">
          {[
            { key: 'stepOne', icon: UserRound },
            { key: 'stepTwo', icon: ShieldCheck },
            { key: 'stepThree', icon: ShoppingBag },
          ].map(({ key, icon: Icon }, i) => (
            <div className="how-step" key={key}>
              <span className="how-icon">
                <Icon size={23} strokeWidth={1.6} />
              </span>
              <div>
                <small>0{i + 1}</small>
                <h3>{t(key)}</h3>
                <p>{t(key + 'Text')}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="local-banner">
        <span className="local-banner-icon">
          <Globe2 size={32} strokeWidth={1.2} />
        </span>
        <div>
          <span className="eyebrow">{t('localFirst')}</span>
          <h3>{t('localText')}</h3>
        </div>
        <button
          className="icon-button"
          onClick={() => navigate('account')}
          aria-label={t('account')}
        >
          <ArrowUpRight size={23} />
        </button>
      </section>
    </div>
  );
}
function Information({ page }: { page: string }) {
  const { t, catalog, navigate } = useApp();
  const settings = catalog.settings;
  return (
    <section className="information-page">
      <span className="round-icon">{page === 'help' ? <CircleHelp /> : <ShieldCheck />}</span>
      <span className="eyebrow">HAMIYA INVESTMENT GROUP</span>
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
