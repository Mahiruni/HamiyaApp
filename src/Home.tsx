import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ChevronRight, Package, Search, ShieldCheck, X } from 'lucide-react';
import { supabase } from './api';
import { Badge, Empty, ProductCard } from './components';
import { catalogRoute, divisionArtwork, divisions } from './storefront';
import { useApp } from './state';
import type { Order, Product } from './types';
import './storefront.css';

const ProductDetails = lazy(() =>
  import('./Commerce').then((module) => ({ default: module.ProductDetails })),
);
const divisionKeys = {
  food: 'divisionFood',
  coffee: 'divisionCoffee',
  vehicles: 'divisionVehicles',
};

export default function Home() {
  const { t, navigate, user, catalog, catalogLoading, catalogError, refreshCatalog, cached } =
    useApp();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const products = catalog.products.filter((product) => product.published).slice(0, 4);
  const current = selected
    ? catalog.products.find((product) => product.id === selected.id) || selected
    : null;
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    navigate(catalogRoute('all', search));
  }
  return (
    <section className="home-page storefront-home">
      <h1 className="home-greeting">
        {t('helloName').replace('{name}', user?.profile.full_name?.split(' ')[0] || t('partner'))}
      </h1>
      <form className="home-search" role="search" onSubmit={submitSearch}>
        <label className="search-field">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label={t('search')}
            placeholder={t('search')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label={t('clear')}>
              <X size={18} />
            </button>
          )}
        </label>
        <button className="search-submit" aria-label={t('search')}>
          <ArrowRight size={20} />
        </button>
      </form>
      <section aria-labelledby="division-heading">
        <div className="store-section-heading">
          <h2 id="division-heading">{t('exploreGroup')}</h2>
          <button className="section-link" onClick={() => navigate('catalog')}>
            {t('viewAll')}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="division-grid">
          {divisions.map((category) => (
            <button
              key={category}
              className={'division-card ' + category}
              onClick={() => navigate(catalogRoute(category))}
            >
              <img
                src={divisionArtwork(category)}
                alt=""
                width={720}
                height={category === 'food' ? 900 : 540}
                decoding="async"
                fetchPriority={category === 'food' ? 'high' : 'auto'}
              />
              <span className="division-copy">
                <strong>{t(divisionKeys[category])}</strong>
                <small>{t(divisionKeys[category] + 'Text')}</small>
              </span>
              <span className="division-arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <LatestOrder />
      {user && user.verification !== 'approved' && (
        <button className="verification-link" onClick={() => navigate('account')}>
          <ShieldCheck size={22} />
          <span>
            <strong>{t('completeVerification')}</strong>
            <small>{t('manageBusinessProfile')}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}
      <section aria-labelledby="featured-heading">
        <div className="store-section-heading">
          <h2 id="featured-heading">{t('featuredProducts')}</h2>
          <button className="section-link" onClick={() => navigate('catalog')}>
            {t('viewAll')}
            <ArrowRight size={17} />
          </button>
        </div>
        {cached && products.length > 0 && <p className="home-catalog-notice">{t('cached')}</p>}
        {catalogError && (
          <div className="notice">
            <span>{t(catalogError)}</span>
            <button className="text-button" onClick={() => void refreshCatalog()}>
              {t('retry')}
            </button>
          </div>
        )}
        {catalogLoading && !products.length ? (
          <div className="product-grid skeleton-grid" aria-label={t('loading')}>
            {[0, 1].map((index) => (
              <div className="skeleton-card" key={index} />
            ))}
          </div>
        ) : products.length ? (
          <div className="product-grid home-product-grid">
            {products.map((product) => (
              <ProductCard product={product} key={product.id} onOpen={setSelected} />
            ))}
          </div>
        ) : (
          <Empty title={t('foodEmpty')} text={t('emptyCatalog')}>
            <button className="button secondary" onClick={() => navigate('catalog')}>
              {t('browseProducts')}
              <ArrowRight size={17} />
            </button>
          </Empty>
        )}
      </section>
      {current && (
        <Suspense fallback={null}>
          <ProductDetails product={current} onClose={() => setSelected(null)} />
        </Suspense>
      )}
    </section>
  );
}

type RecentOrder = Pick<Order, 'id' | 'status' | 'items'>;

function LatestOrder() {
  const { t, user, navigate, catalog, language } = useApp();
  const uid = user?.id;
  const [result, setResult] = useState<{
    uid: string;
    order: RecentOrder | null;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client || !uid) return;
    let active = true;
    let inFlight = false;
    async function load() {
      if (inFlight || !client) return;
      inFlight = true;
      try {
        const { data, error } = await client
          .from('hamiya_orders')
          .select('id,status,items')
          .eq('customer_id', uid!)
          .order('created_at', { ascending: false })
          .limit(1);
        if (active)
          setResult({ uid: uid!, order: error ? null : data?.[0] || null, error: !!error });
      } catch {
        if (active) setResult({ uid: uid!, order: null, error: true });
      } finally {
        inFlight = false;
      }
    }
    void load();
    const channel = client
      .channel('hamiya-home-orders-' + uid)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hamiya_orders', filter: `customer_id=eq.${uid}` },
        () => void load(),
      )
      .subscribe();
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {
      active = false;
      void client.removeChannel(channel);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', visible);
    };
  }, [uid]);
  if (!uid) return null;
  const data = result?.uid === uid ? result : null;
  const order = data?.order;
  const item = order?.items[0];
  const product = item && catalog.products.find((entry) => entry.id === item.product_id);
  const name = product?.translations[language]?.name || item?.name;
  return (
    <button
      className="latest-order"
      onClick={() =>
        navigate(order ? 'orders/' + order.id : !data || data.error ? 'orders' : 'catalog')
      }
    >
      <span className="latest-order-icon">
        <Package size={23} />
      </span>
      <span className="latest-order-copy">
        <strong>
          {order ? t('latestOrder') : t(data && !data.error ? 'startOrder' : 'orders')}
        </strong>
        <small>
          {order && item
            ? `${item.quantity} × ${name}`
            : t(!data ? 'loading' : data.error ? 'latestLoadError' : 'shopCatalog')}
        </small>
        {order && <Badge status={order.status} />}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}
