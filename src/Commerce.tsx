import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppError,
  clearSubmissionKey,
  configured,
  hydrateProduct,
  rpc,
  submissionKey,
  supabase,
} from './api';
import {
  Badge,
  Button,
  categoryIcons,
  Dialog,
  Empty,
  Field,
  DivisionBanner,
  ProductCard,
  Money,
  ProductArt,
} from './components';
import { ProductSheet } from './ProductSheet';
import {
  foodMaximum,
  foodMinimum,
  purchasable,
  stepFoodQuantity,
  validFoodQuantity,
} from './quantity';
import { availableForCustomer, matchesProduct } from './catalog';
import { confirmFeedback } from './native-platform';
import { useApp } from './state';
import type { Enquiry, Order, Product } from './types';
import { catalogLocation, catalogRoute, unitLabel, variantLabel } from './storefront';

export function CatalogPage() {
  const { t, catalog, route, navigate, catalogLoading, catalogError, refreshCatalog, cached } =
    useApp();
  const { category, search: routeSearch } = catalogLocation(route);
  const [search, setSearch] = useState(routeSearch);
  useEffect(() => {
    setSearch(routeSearch);
    setLimit(12);
  }, [routeSearch, category]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [limit, setLimit] = useState(12);
  const products = catalog.products.filter(
    (p) =>
      p.published &&
      (category === 'all' || p.category === category) &&
      (!onlyAvailable || availableForCustomer(p)) &&
      matchesProduct(p, search, t),
  );
  const Icon = category === 'all' ? Package : categoryIcons[category] || Package;
  const currentSelected = selected
    ? catalog.products.find((p) => p.id === selected.id) || selected
    : null;
  return (
    <section className="catalog-page hamiya-elegant-catalog">
      <div className="page-heading">
        <div>
          <span className="eyebrow">HAMIYA</span>
          <h1>{t('browseProducts')}</h1>
          <p>{t('catalogHint')}</p>
        </div>
      </div>
      {category !== 'all' && <DivisionBanner category={category} />}
      <div className="catalog-toolbar">
        <div className="category-tabs">
          {(['all', 'food', 'coffee', 'vehicles'] as const).map((value) => (
            <button
              key={value}
              className={category === value ? 'active' : ''}
              aria-pressed={category === value}
              onClick={() => {
                navigate(catalogRoute(value, search));
                setLimit(12);
              }}
            >
              {value !== 'all' &&
                (() => {
                  const TabIcon = categoryIcons[value];
                  return <TabIcon size={16} />;
                })()}
              {t(value)}
            </button>
          ))}
        </div>
        <div className="catalog-controls">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label={t('search')}
              placeholder={t('search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(12);
              }}
            />
            {search && (
              <button aria-label={t('clear')} onClick={() => setSearch('')}>
                <X size={16} />
              </button>
            )}
          </label>
          <label className="available-filter">
            <SlidersHorizontal size={17} />
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
            />
            {t('availableOnly')}
          </label>
        </div>
      </div>
      {cached && configured && <div className="notice">{t('cached')}</div>}
      {catalogError && configured && (
        <div className="notice">
          <span>{t(catalogError)}</span>
          <button className="text-button" onClick={() => void refreshCatalog()}>
            {t('retry')}
          </button>
        </div>
      )}
      {catalogLoading ? (
        <div className="skeleton-grid" aria-label={t('loading')}>
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton-card" key={i} />
          ))}
        </div>
      ) : products.length ? (
        <>
          <div className="catalog-count">
            <h2>{t(category === 'all' ? 'all' : category)}</h2>
            <span>
              {products.length} {t('items')}
            </span>
          </div>
          <div className="product-grid">
            {products.slice(0, limit).map((product) => (
              <ProductCard product={product} key={product.id} onOpen={setSelected} />
            ))}
          </div>
          {products.length > limit && (
            <button className="button secondary load-more" onClick={() => setLimit(limit + 12)}>
              {t('viewAll')}
            </button>
          )}
        </>
      ) : (
        <Empty
          icon={Icon}
          title={
            search || onlyAvailable
              ? t('noResults')
              : t((category === 'all' ? 'food' : category) + 'Empty')
          }
          text={search || onlyAvailable ? t('trySearch') : t('emptyCatalog')}
        >
          {(search || onlyAvailable) && (
            <button
              className="text-button"
              onClick={() => {
                setSearch('');
                setOnlyAvailable(false);
              }}
            >
              {t('clear')}
            </button>
          )}
        </Empty>
      )}
      {currentSelected && (
        <ProductDetails product={currentSelected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

export function ProductDetails({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t, language, user, addCart, navigate, toast, notifyError, online, cart } = useApp();
  const [quantity, setQuantity] = useState(String(foodMinimum));
  const quantityNumber = Number(quantity);
  const inCart = cart.find((item) => item.id === product.id)?.quantity || 0;
  const remaining = Math.max(0, product.available_quantity - inCart);
  const maximum = Math.min(foodMaximum, remaining);
  const validQuantity = validFoodQuantity(quantity, remaining);
  const [enquiring, setEnquiring] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const key = useRef(crypto.randomUUID());
  const name = product.translations[language]?.name || product.name;
  const description =
    product.translations[language]?.description || product.translations.en?.description;
  const orderable = purchasable(product);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !online) return;
    submitting.current = true;
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      await rpc('request_submit', {
        product_id: product.id,
        client_key: key.current,
        ...Object.fromEntries(data),
      });
      toast(t('requestSent'));
      confirmFeedback();
      onClose();
      navigate('orders');
    } catch (error) {
      notifyError(error);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const footer =
    product.category === 'food' ? (
      <>
        <div className="sheet-quantity-line">
          <div className="sheet-quantity-copy">
            <label htmlFor={'quantity-' + product.id}>{t('foodQuantity')}</label>
            <small>{t('minimumCartons')}</small>
          </div>
          <div className="sheet-stepper">
            <button
              type="button"
              aria-label={t('remove')}
              disabled={quantityNumber <= foodMinimum}
              onClick={() => setQuantity(String(stepFoodQuantity(quantity, -1, remaining)))}
            >
              <Minus size={18} />
            </button>
            <input
              id={'quantity-' + product.id}
              type="number"
              inputMode="numeric"
              min={foodMinimum}
              max={maximum}
              step={1}
              value={quantity}
              aria-invalid={!validQuantity}
              aria-describedby={'quantity-hint-' + product.id}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <button
              type="button"
              aria-label={t('add')}
              disabled={!orderable || quantityNumber >= maximum}
              onClick={() => setQuantity(String(stepFoodQuantity(quantity, 1, remaining)))}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <div
          id={'quantity-hint-' + product.id}
          className={validQuantity ? 'sheet-total' : 'sheet-quantity-error'}
          aria-live="polite"
        >
          {validQuantity ? (
            <>
              {t('total')}: <Money value={quantityNumber * (product.price_cents || 0)} />
            </>
          ) : (
            t(remaining < foodMinimum ? 'stockBelowMinimum' : 'quantityInvalid')
          )}
        </div>
        <button
          className="button primary"
          disabled={!orderable || !online || !validQuantity}
          onClick={() => {
            if (validQuantity) {
              addCart(product, quantityNumber);
              onClose();
            }
          }}
        >
          <ShoppingBag size={18} />
          {t(orderable ? 'addCart' : 'unavailable')}
        </button>
      </>
    ) : undefined;
  return (
    <ProductSheet title={name} onClose={onClose} footer={footer}>
      <div className="sheet-art">
        <ProductArt product={product} />
      </div>
      <div className="sheet-summary">
        <span className="eyebrow">
          {variantLabel(product.variant, t) || t(product.category + 'Brand')}
        </span>
        <Badge status={product.status} />
      </div>
      <div className="sheet-price">
        {product.price_cents ? (
          <Money value={product.price_cents} />
        ) : (
          <strong>{t('pricePending')}</strong>
        )}
        <p>{product.sales_unit ? '/ ' + unitLabel(product.sales_unit, t) : t('unitPending')}</p>
      </div>
      {description && <p>{description}</p>}
      <dl className="sheet-facts">
        {product.pack_count && (
          <div>
            <dt>{t('pack')}</dt>
            <dd>{product.pack_count}</dd>
          </div>
        )}
        {product.category === 'food' && product.confirmed && (
          <div>
            <dt>{t('stock')}</dt>
            <dd>
              {product.available_quantity} {unitLabel(product.sales_unit, t)}
            </dd>
          </div>
        )}
        {Object.entries(product.attributes)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {product.category !== 'food' &&
        (!enquiring ? (
          <button
            className="button primary full"
            disabled={!['available', 'coming_soon'].includes(product.status) || !online}
            onClick={() => {
              if (!user || user.verification !== 'approved' || !user.email_verified) {
                onClose();
                navigate('account');
                toast(t('approvalNotice'));
                return;
              }
              setEnquiring(true);
            }}
          >
            {t(product.category === 'coffee' ? 'requestQuote' : 'enquire')}
            <ArrowRight size={16} />
          </button>
        ) : (
          <form onSubmit={submit}>
            {product.category === 'coffee' && (
              <>
                <div className="form-grid">
                  <Field label={t('quantity')} name="quantity" required maxLength={100} />
                  <Field label={t('unit')} name="unit" required maxLength={100} />
                </div>
                <Field label={t('packaging')} name="packaging" maxLength={300} />
                <Field label={t('destination')} name="destination" required maxLength={500} />
              </>
            )}
            <label className="field">
              <span>{t('notes')} *</span>
              <textarea name="notes" required rows={3} maxLength={2000} />
            </label>
            <Button busy={busy} disabled={!online}>
              {t('submit')}
              <ArrowRight size={16} />
            </Button>
          </form>
        ))}
    </ProductSheet>
  );
}

export function Cart() {
  const {
    t,
    language,
    cart,
    setCart,
    setCartOpen,
    catalog,
    user,
    navigate,
    online,
    notifyError,
    toast,
    refreshCatalog,
  } = useApp();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [fulfilment, setFulfilment] = useState(catalog.settings.pickup ? 'pickup' : 'delivery');
  const [note, setNote] = useState('');
  const key = useRef(crypto.randomUUID());
  const allowed = !!user && user.verification === 'approved' && user.email_verified;
  const changed = cart.some((item) => {
    const p = catalog.products.find((p) => p.id === item.id);
    return (
      !p ||
      !purchasable(p) ||
      !validFoodQuantity(draftQuantities[item.id] ?? String(item.quantity), p.available_quantity) ||
      p.price_cents !== item.price_cents ||
      p.sales_unit !== item.sales_unit ||
      item.quantity < 20 ||
      item.quantity > p.available_quantity ||
      !['available', 'low_stock'].includes(p.status)
    );
  });
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price_cents, 0);
  const fee = fulfilment === 'delivery' ? catalog.settings.delivery_fee_cents || 0 : 0;
  function setCartQuantity(id: string, quantity: number) {
    const p = catalog.products.find((product) => product.id === id);
    if (!p || !validFoodQuantity(String(quantity), p.available_quantity)) return;
    setCart(cart.map((item) => (item.id === id ? { ...item, quantity } : item)));
    key.current = crypto.randomUUID();
  }
  function adjust(id: string, amount: number) {
    const p = catalog.products.find((p) => p.id === id);
    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: stepFoodQuantity(String(item.quantity), amount, p?.available_quantity || 0),
            }
          : item,
      ),
    );
    key.current = crypto.randomUUID();
  }
  async function submit() {
    if (submitting.current || !online || !cart.length || changed) return;
    if (!allowed) {
      setCartOpen(false);
      navigate('account');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const payload = {
        items: cart.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          price_cents: item.price_cents,
          sales_unit: item.sales_unit,
        })),
        fulfilment,
        note,
      };
      const scope = 'order-' + user!.id;
      await rpc('order_submit', { ...payload, client_key: await submissionKey(scope, payload) });
      clearSubmissionKey(scope);
      setCart([]);
      setCartOpen(false);
      navigate('orders');
      toast(t('orderPlaced'));
      confirmFeedback();
      await refreshCatalog();
    } catch (error) {
      notifyError(error);
      if (error instanceof AppError && ['stock_changed', 'price_changed'].includes(error.code))
        await refreshCatalog();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog title={t('cart')} onClose={() => setCartOpen(false)}>
      {!cart.length ? (
        <Empty icon={ShoppingBag} title={t('emptyCart')} text={t('emptyCartText')}>
          <button
            className="button primary"
            onClick={() => {
              setCartOpen(false);
              navigate('catalog/food');
            }}
          >
            {t('explore')}
            <ArrowRight size={16} />
          </button>
        </Empty>
      ) : (
        <>
          <div className="cart-list">
            {cart.map((item) => {
              const product = catalog.products.find((p) => p.id === item.id);
              const name = product?.translations[language]?.name || item.name;
              const maximum = Math.min(foodMaximum, product?.available_quantity || 0);
              return (
                <div className="cart-item" key={item.id}>
                  <span className="cart-product-icon">
                    <Package size={24} />
                  </span>
                  <div className="cart-item-content">
                    <strong>{name}</strong>
                    <span>
                      <Money value={item.price_cents} /> / {unitLabel(item.sales_unit, t)}
                    </span>
                    <div className="quantity-stepper">
                      <button
                        aria-label={t('remove')}
                        onClick={() => {
                          setDraftQuantities((values) => {
                            const next = { ...values };
                            delete next[item.id];
                            return next;
                          });
                          adjust(item.id, -1);
                        }}
                        disabled={busy || item.quantity <= 20}
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        className="cart-quantity-input"
                        type="number"
                        inputMode="numeric"
                        min={20}
                        max={maximum}
                        step={1}
                        aria-label={t('quantity') + ' · ' + name}
                        value={draftQuantities[item.id] ?? String(item.quantity)}
                        aria-invalid={
                          !validFoodQuantity(
                            draftQuantities[item.id] ?? String(item.quantity),
                            catalog.products.find((p) => p.id === item.id)?.available_quantity || 0,
                          )
                        }
                        disabled={busy}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDraftQuantities((previous) => ({ ...previous, [item.id]: value }));
                          if (
                            validFoodQuantity(
                              value,
                              catalog.products.find((p) => p.id === item.id)?.available_quantity ||
                                0,
                            )
                          )
                            setCartQuantity(item.id, Number(value));
                        }}
                      />
                      <button
                        aria-label={t('add')}
                        onClick={() => {
                          setDraftQuantities((values) => {
                            const next = { ...values };
                            delete next[item.id];
                            return next;
                          });
                          adjust(item.id, 1);
                        }}
                        disabled={busy || item.quantity >= maximum}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    className="icon-button danger"
                    aria-label={t('remove')}
                    disabled={busy}
                    onClick={() => {
                      setCart(cart.filter((x) => x.id !== item.id));
                      key.current = crypto.randomUUID();
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
          {changed && (
            <div className="notice">
              <span>{t('cartChanged')}</span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setCart(
                    cart.flatMap((item) => {
                      const p = catalog.products.find((p) => p.id === item.id);
                      return p && purchasable(p)
                        ? [
                            {
                              ...item,
                              price_cents: p.price_cents,
                              sales_unit: p.sales_unit,
                              quantity: Math.min(item.quantity, p.available_quantity),
                            },
                          ]
                        : [];
                    }),
                  );
                  setDraftQuantities({});
                  key.current = crypto.randomUUID();
                }}
              >
                {t('update')}
              </button>
            </div>
          )}
          <h3>{t('fulfilment')}</h3>
          <div className="fulfilment-options">
            {(['pickup', 'delivery'] as const)
              .filter((option) => catalog.settings[option])
              .map((option) => (
                <label className={fulfilment === option ? 'active' : ''} key={option}>
                  <input
                    type="radio"
                    name="fulfilment"
                    value={option}
                    checked={fulfilment === option}
                    onChange={() => setFulfilment(option)}
                  />
                  {t(option)}
                  {fulfilment === option && <Check size={15} />}
                </label>
              ))}
          </div>
          {fulfilment === 'pickup' && catalog.settings.pickup_address && (
            <p className="muted">{catalog.settings.pickup_address}</p>
          )}
          {user && (
            <p className="muted">
              {user.profile.address}, {user.profile.city} · {user.profile.phone}
            </p>
          )}
          <label className="field">
            <span>{t('note')}</span>
            <textarea
              rows={2}
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="cart-totals">
            <div>
              <span>{t('subtotal')}</span>
              <Money value={subtotal} />
            </div>
            {fulfilment === 'delivery' && (
              <div>
                <span>{t('delivery')}</span>
                <Money value={fee} />
              </div>
            )}
            <div className="grand-total">
              <strong>{t('total')}</strong>
              <Money value={subtotal + fee} />
            </div>
          </div>
          <p className="muted small-text">{t('orderNotice')}</p>
          {!allowed && <div className="notice">{t('approvalNotice')}</div>}
          <Button
            busy={busy}
            className="button primary full"
            disabled={
              busy || !online || changed || (!catalog.settings.pickup && !catalog.settings.delivery)
            }
            onClick={() => void submit()}
          >
            {t(busy ? 'loading' : allowed ? 'submitOrder' : 'finishProfile')}
            <ArrowRight size={17} />
          </Button>
        </>
      )}
    </Dialog>
  );
}

export function OrdersPage() {
  const { t, user, navigate, notifyError, online, route } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'orders' | 'requests'>('all');
  const linkedOrder = route.split('/')[1];
  useEffect(() => {
    const order = orders.find((entry) => entry.id === linkedOrder);
    if (!order) return;
    // Consume the detail link before opening a Back-aware sheet, so closing it cannot reopen it.
    navigate('orders', { replace: true });
    setSelected(order);
  }, [linkedOrder, orders, navigate]);
  async function load() {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        supabase
          .from('hamiya_orders')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('hamiya_requests')
          .select('*,hamiya_products(name)')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (a.error || b.error) throw a.error || b.error;
      setOrders(a.data || []);
      setRequests((b.data || []).map((r) => ({ ...r, name: r.hamiya_products?.name })));
      setError(false);
    } catch (error) {
      notifyError(error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    void load();
    const channel = supabase
      ?.channel('hamiya-own-orders-' + uid)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hamiya_orders', filter: `customer_id=eq.${uid}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hamiya_requests', filter: `customer_id=eq.${uid}` },
        () => void load(),
      )
      .subscribe();
    const visible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      if (channel) void supabase?.removeChannel(channel);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [uid]);
  if (!user)
    return (
      <Empty icon={ShoppingBag} title={t('orderHistory')} text={t('accountGate')}>
        <button className="button primary" onClick={() => navigate('account')}>
          {t('signIn')}
          <ArrowRight size={16} />
        </button>
      </Empty>
    );
  const current = selected ? orders.find((o) => o.id === selected.id) || selected : null;
  function closeOrder() {
    setSelected(null);
  }
  const visibleOrders = filter === 'requests' ? [] : orders;
  const visibleRequests = filter === 'orders' ? [] : requests;
  const pendingCount =
    orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length +
    requests.filter((request) => !['closed', 'rejected'].includes(request.status)).length;
  return (
    <section className="orders-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('business')}</span>
          <h1>{t('orderHistory')}</h1>
          <p>{t('orderIntro')}</p>
        </div>
        <button
          className="button secondary"
          disabled={!online || loading}
          onClick={() => void load()}
        >
          {t('refresh')}
        </button>
      </div>
      <div className="orders-overview" aria-label={t('orderHistory')}>
        <div className="orders-overview-card">
          <span>{t('orderNumber')}</span>
          <strong>{orders.length}</strong>
          <small>{t('orders')}</small>
        </div>
        <div className="orders-overview-card">
          <span>{t('enquiry')}</span>
          <strong>{requests.length}</strong>
          <small>{t('requests')}</small>
        </div>
        <div className="orders-overview-card accent">
          <span>{t('activeOrders')}</span>
          <strong>{pendingCount}</strong>
          <small>{t('orders')}</small>
        </div>
      </div>
      <div className="orders-filter" role="tablist" aria-label={t('orderHistory')}>
        {(
          [
            ['all', t('all')],
            ['orders', t('orders')],
            ['requests', t('enquiry')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? 'active' : ''}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="loading-row">{t('loading')}</div>
      ) : error ? (
        <Empty title={t('connectionError')}>
          <button className="button secondary" onClick={() => void load()}>
            {t('retry')}
          </button>
        </Empty>
      ) : !visibleOrders.length && !visibleRequests.length ? (
        <Empty icon={ShoppingBag} title={t('noOrders')} text={t('noOrdersText')}>
          <button className="button primary" onClick={() => navigate('catalog')}>
            {t('explore')}
            <ArrowRight size={16} />
          </button>
        </Empty>
      ) : (
        <div className="order-grid">
          {visibleOrders.map((order) => (
            <button
              className="order-card panel"
              key={order.id}
              onClick={() => setSelected(order)}
              aria-label={t('orderNumber') + ' #' + order.id.slice(0, 8).toUpperCase()}
            >
              <div className="order-card-top">
                <span className="round-icon">
                  <ShoppingBag size={20} />
                </span>
                <span className="order-card-kind">{t('orderNumber')}</span>
                <Badge status={order.status} />
              </div>
              <h3>
                {t('orderNumber')} #{order.id.slice(0, 8).toUpperCase()}
              </h3>
              <p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p>
              <div className="order-card-bottom">
                <Money value={order.total_cents} />
                <ChevronRight size={18} />
              </div>
              <small>
                {new Date(order.created_at).toLocaleDateString()} · {t(order.fulfilment)}
              </small>
            </button>
          ))}
          {visibleRequests.map((request) => (
            <div className="order-card panel" key={request.id}>
              <div className="order-card-top">
                <span className="round-icon">
                  <FileText size={20} />
                </span>
                <span className="order-card-kind">{t('enquiry')}</span>
                <Badge status={request.status} />
              </div>
              <h3>{request.name || t(request.category + 'Brand')}</h3>
              <p>{request.details.notes}</p>
              {request.quote_cents && (
                <div className="quotation">
                  <span>{t('quotation')}</span>
                  <strong>
                    <Money value={request.quote_cents} /> / {request.quote_unit}
                  </strong>
                </div>
              )}
              {request.response && (
                <p>
                  <strong>{t('response')}: </strong>
                  {request.response}
                </p>
              )}
              <small>
                {new Date(request.created_at).toLocaleDateString()} · {t('enquiry')}
              </small>
            </div>
          ))}
        </div>
      )}
      {current && (
        <Dialog
          title={t('orderNumber') + ' #' + current.id.slice(0, 8).toUpperCase()}
          onClose={closeOrder}
        >
          <Badge status={current.status} />
          <div className="order-lines">
            {current.items.map((item) => (
              <div key={item.product_id}>
                <span>
                  {item.quantity} × {item.name} {item.variant}
                  <small>{item.sales_unit}</small>
                </span>
                <Money value={item.quantity * item.price_cents} />
              </div>
            ))}
          </div>
          <div className="cart-totals">
            {current.delivery_fee_cents > 0 && (
              <div>
                <span>{t('delivery')}</span>
                <Money value={current.delivery_fee_cents} />
              </div>
            )}
            <div className="grand-total">
              <strong>{t('total')}</strong>
              <Money value={current.total_cents} />
            </div>
          </div>
          <p className="muted">
            {t(current.fulfilment)} · {t('unpaid')}
          </p>
          <p>
            {current.address.address}, {current.address.city}
          </p>
          <p>{current.note}</p>
          {['submitted', 'accepted'].includes(current.status) && (
            <Button
              busy={busy}
              className="button secondary full danger"
              disabled={busy || !online}
              onClick={async () => {
                setBusy(true);
                try {
                  await rpc('order_cancel', { id: current.id });
                  await load();
                  closeOrder();
                } catch (error) {
                  notifyError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('cancel')}
            </Button>
          )}
        </Dialog>
      )}
    </section>
  );
}

export function useAdminProducts(products: Product[]) {
  return products.map(hydrateProduct);
}
