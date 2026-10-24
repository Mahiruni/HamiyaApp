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
import { CategoryCard, Empty } from './components';
import { Cart, CatalogPage, OrdersPage } from './Commerce';
import { languages } from './i18n';
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
    setLanguage,
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
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
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
    <div className={isStaff ? "app admin-app-shell" : "app"}>
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
      <aside ref={drawerRef} className={'sidebar ' + (drawer ? 'open' : '')}>
        <div className="sidebar-brand">
          <button className="brand" aria-label="Hamiya" onClick={() => go(isStaff ? 'admin' : 'home')}>
            <span className="brand-mark">
              h<span />
            </span>
            <span className="brand-name">
              hamiya<small>INVESTMENT GROUP</small>
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
          {(isStaff ? adminNavigation : navigation).map(({ route: destination, label, icon: Icon }) => (
            <button
              key={destination}
              className={'nav-link ' + ((isStaff ? route === destination : root === destination) ? 'active' : '')}
              onClick={() => go(destination)}
            >
              <Icon size={19} strokeWidth={1.7} />
              {isStaff ? label : t(label)}
              {root === destination && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        {!isStaff && <div className="sidebar-section-label">{t('family')}</div>}
        {!isStaff && <div className="sidebar-businesses">
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
        </div>}
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
              className="icon-button mobile-only"
              aria-label={t('categories')}
              onClick={() => setDrawer(true)}
            >
              <Menu size={23} />
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
            <button className="mobile-wordmark" onClick={() => navigate(isStaff ? 'admin' : 'home')}>
              hamiya<span>®</span>
            </button>
          </div>
          <div className="topbar-actions">
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
            <span className="topbar-separator" />
            {!isStaff && <button
              className="icon-button cart-button"
              aria-label={t('cart')}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={21} />
              {cart.length > 0 && (
                <span className="cart-count">{cart.reduce((a, b) => a + b.quantity, 0)}</span>
              )}
            </button>}
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
      {!isStaff && <nav className="mobile-nav" aria-label={t('categories')} inert={drawer}>
        {navigation.map(({ route: destination, label, icon: Icon }) => (
          <button
            key={destination}
            className={root === destination ? 'active' : ''}
            onClick={() => go(destination)}
          >
            <Icon size={21} strokeWidth={root === destination ? 2 : 1.7} />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>}
      {!isStaff && cartOpen && <Cart />}
    </div>
  );
}
function EntryLoading() {
  const { t } = useApp();
  return (
    <div className="entry-loading" role="status">
      <strong>hamiya</strong>
      <span>{t('loading')}</span>
    </div>
  );
}
function Home() {
  const { t, navigate, user, catalog, cart } = useApp();
  const published = catalog.products.filter((product) => product.published);
  const available = published.filter((product) => product.available_quantity > 0);
  const divisions = [
    { id: 'food', title: 'HAMIYA Food Processing', detail: 'Wholesale food and beverage products', icon: Wheat, count: published.filter((p) => p.category === 'food').length },
    { id: 'coffee', title: 'Hawinet Coffee Export', detail: 'Ethiopian coffee and export enquiries', icon: Coffee, count: published.filter((p) => p.category === 'coffee').length },
    { id: 'vehicles', title: 'Premium Car Import', detail: 'Vehicle sourcing and import enquiries', icon: CarFront, count: published.filter((p) => p.category === 'vehicles').length },
  ] as const;
  const verificationLabel = user?.verification === 'approved' ? 'Verified business' : user?.verification === 'submitted' || user?.verification === 'under_review' ? 'Verification in review' : 'Complete verification';
  return (
    <div className="home-page">
      <div className="home-intro">
        <div>
          <span className="intro-dot" />
          {t(user ? 'welcomeBack' : 'welcome')}
          {user && `, ${user.profile.full_name?.split(' ')[0]}`}
        </div>
        <span className="intro-location">
          {t('country')} <span>·</span> ETB
        </span>
      </div>
      <section className="hamiya-dashboard" aria-label="HAMIYA customer dashboard">
        <div className="hamiya-dash-head">
          <div className="hamiya-dash-heading">
            <span className="hamiya-dash-kicker"><span className="hamiya-live-dot" /> HAMIYA CUSTOMER PORTAL</span>
            <h1>{user ? `Welcome back, ${user.profile.full_name?.split(' ')[0] || 'partner'}.` : 'Welcome to HAMIYA.'}</h1>
            <p>{user ? 'Everything your business needs, in one place. Explore products, place orders and manage your account.' : 'Your direct connection to HAMIYA Investment Group. Discover products across our three businesses.'}</p>
          </div>
          <div className="hamiya-dash-date"><Building2 size={17} /><span>HAMIYA Investment Group</span></div>
        </div>
        <div className="hamiya-dash-grid">
          <div className="hamiya-dash-main">
            <div className="hamiya-dash-main-top">
              <span className="hamiya-dash-overline">YOUR BUSINESS, CONNECTED</span>
              <span className="hamiya-dash-mark" aria-hidden="true">H.</span>
            </div>
            <h2>Discover. Order.<br /><em>Grow together.</em></h2>
            <p>Food processing, Ethiopian coffee exports and premium vehicles — one trusted business partner.</p>
            <div className="hamiya-dash-actions">
              <button className="hamiya-dash-action-primary" onClick={() => navigate('catalog')}>Explore products <ArrowUpRight size={18}/></button>
              <button className="hamiya-dash-action-secondary" onClick={() => navigate(user ? 'orders' : 'account')}>{user ? 'My orders' : 'Create account'} <ArrowRight size={17}/></button>
            </div>
            <div className="hamiya-dash-main-bottom"><span>HAMIYA INVESTMENT GROUP</span><span>ETHIOPIA · ETB</span></div>
          </div>
          <div className="hamiya-dash-side">
            <div className="hamiya-dash-side-label"><span>AT A GLANCE</span><LayoutGrid size={17}/></div>
            <div className="hamiya-dash-metrics">
              <div><strong>{divisions.length.toString().padStart(2,'0')}</strong><span>Business divisions</span></div>
              <div><strong>{published.length}</strong><span>Listed products</span></div>
              <div><strong>{available.length}</strong><span>In stock now</span></div>
              <div><strong>{cart.reduce((sum,item) => sum + item.quantity,0)}</strong><span>Items in your cart</span></div>
            </div>
            <button className="hamiya-dash-status" onClick={() => navigate('account')}>
              <ShieldCheck size={19}/>
              <span><strong>{user ? verificationLabel : 'Secure customer registration'}</strong><small>{user ? 'Manage your business profile' : 'Get started with a verified account'}</small></span>
              <ChevronRight size={17}/>
            </button>
          </div>
        </div>
        <div className="hamiya-dash-section-heading">
          <div><span className="hamiya-dash-overline">EXPLORE HAMIYA</span><h2>Our business divisions</h2></div>
          <button onClick={() => navigate('catalog')}>Browse catalog <ArrowRight size={16}/></button>
        </div>
        <div className="hamiya-division-grid">
          {divisions.map(({ id, title, detail, icon: Icon, count }, index) => (
            <button className="hamiya-division" key={id} onClick={() => navigate('catalog/' + id)}>
              <div className="hamiya-division-top"><span className="hamiya-division-icon"><Icon size={23} strokeWidth={1.6}/></span><ArrowUpRight size={19}/></div>
              <span className="hamiya-division-index">0{index + 1} / HAMIYA GROUP</span>
              <strong>{title}</strong><small>{detail}</small>
              <span className="hamiya-division-bottom">{count ? `${count} listed products` : 'Explore division'} <ArrowRight size={15}/></span>
            </button>
          ))}
        </div>
      </section>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-label">
            <span />
            {t('eyebrow')}
          </div>
          <h1>
            {t('heroTitle')}
            <br />
            <em>{t('heroAccent')}</em>
          </h1>
          <p>{t('heroText')}</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => navigate('catalog')}>
              {t('explore')}
              <ArrowUpRight size={18} />
            </button>
            {!user && (
              <button className="hero-register" onClick={() => navigate('account')}>
                {t('createAccount')}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="hero-footnote">
            <span className="language-stack">
              አ<span>En</span>
              <b>Af</b>
            </span>
            <span>
              አማርኛ <i>·</i> English <i>·</i> Afaan Oromoo
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-1" />
          <div className="art-orbit orbit-2" />
          <div className="art-sun" />
          <div className="art-pedestal tall">
            <div className="art-food">
              <Wheat size={92} strokeWidth={0.9} />
            </div>
            <span>HAMIYA</span>
          </div>
          <div className="art-pedestal short">
            <div className="art-coffee">
              <Coffee size={86} strokeWidth={0.9} />
            </div>
            <span>HAWINET</span>
          </div>
          <div className="art-car">
            <CarFront size={104} strokeWidth={0.9} />
          </div>
          <span className="art-spark spark-1">✦</span>
          <span className="art-spark spark-2">✦</span>
          <div className="art-caption">
            <span className="connected-dot" />
            {t('businessHome')}
          </div>
        </div>
      </section>
      <section className="businesses-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HAMIYA INVESTMENT GROUP</span>
            <h2>{t('ourBusinesses')}</h2>
          </div>
          <button className="text-button" onClick={() => navigate('catalog')}>
            {t('viewAll')}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="business-grid">
          {(['food', 'coffee', 'vehicles'] as const).map((category, index) => (
            <CategoryCard key={category} category={category} index={index} />
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="section-heading">
          <div>
            <h2>{t('howWorks')}</h2>
            <p>{t('howIntro')}</p>
          </div>
          <span className="how-flower">✳</span>
        </div>
        <div className="how-grid">
          {[
            { key: 'stepOne', icon: UserRound },
            { key: 'stepTwo', icon: ShieldCheck },
            { key: 'stepThree', icon: ShoppingBag },
          ].map(({ key, icon: Icon }, i) => (
            <div className="how-step" key={key}>
              <span className="how-icon">
                <Icon size={23} strokeWidth={1.4} />
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
          <Globe2 size={36} strokeWidth={1} />
        </span>
        <div>
          <span className="eyebrow">{t('localFirst')}</span>
          <h3>{t('localText')}</h3>
        </div>
        <button
          className="icon-button"
          onClick={() => navigate('account')}
          aria-label={t('createAccount')}
        >
          <ArrowUpRight size={25} />
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
