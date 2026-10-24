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
import { Badge, categoryIcons, Dialog, Empty, Field, Money, ProductArt } from './components';
import { useApp } from './state';
import type { Category, Enquiry, Order, Product } from './types';

export function CatalogPage() {
  const {
    t,
    catalog,
    language,
    route,
    navigate,
    catalogLoading,
    catalogError,
    refreshCatalog,
    cached,
  } = useApp();
  const category = (route.split('/')[1] || 'all') as Category | 'all';
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [limit, setLimit] = useState(12);
  const products = catalog.products.filter(
    (p) =>
      (category === 'all' || p.category === category) &&
      (!onlyAvailable || ['available', 'low_stock'].includes(p.status)) &&
      ((p.translations[language]?.name || p.name) + ' ' + p.variant)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const Icon = category === 'all' ? Package : categoryIcons[category] || Package;
  const currentSelected = selected
    ? catalog.products.find((p) => p.id === selected.id) || selected
    : null;
  return (
    <section className="catalog-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('collection')}</span>
          <h1>{t('catalogTitle')}</h1>
          <p>{t('catalogText')}</p>
        </div>
        <div className="small-seal">
          <Package size={26} />
          <span>
            HAMIYA
            <br />
            INVESTMENT GROUP
          </span>
        </div>
      </div>
      <div className="catalog-toolbar">
        <div className="category-tabs">
          {(['all', 'food', 'coffee', 'vehicles'] as const).map((value) => (
            <button
              key={value}
              className={category === value ? 'active' : ''}
              onClick={() => {
                navigate('catalog' + (value === 'all' ? '' : '/' + value));
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
            {t(category === 'all' ? 'all' : category)}
            <span>
              {products.length} {t('items')}
            </span>
          </div>
          <div className="product-grid">
            {products.slice(0, limit).map((product) => (
              <button
                className="product-card"
                key={product.id}
                onClick={() => setSelected(product)}
              >
                <ProductArt product={product} />
                <div className="product-content">
                  <div className="product-title-row">
                    <span className="product-variant">
                      {product.variant || t(product.category)}
                    </span>
                    <Badge status={product.status} />
                  </div>
                  <h3>{product.translations[language]?.name || product.name}</h3>
                  <p>
                    {product.pack_count
                      ? `${product.pack_count} · ${t('pack')}`
                      : product.category === 'food'
                        ? t('notProvided')
                        : t(product.category + 'Brand')}
                  </p>
                  <div className="product-price-row">
                    <div>
                      {product.price_cents ? (
                        <Money value={product.price_cents} />
                      ) : (
                        <strong>{t('pricePending')}</strong>
                      )}
                      <small>
                        {product.sales_unit ? '/ ' + product.sales_unit : t('unitPending')}
                      </small>
                    </div>
                    <span className="product-arrow">
                      <ChevronRight size={18} />
                    </span>
                  </div>
                </div>
              </button>
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

function ProductDetails({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t, language, user, addCart, navigate, toast, notifyError, online } = useApp();
  const minimumOrder = product.category === 'food' ? 20 : 1;
  const [quantity, setQuantity] = useState(String(minimumOrder));
  const quantityNumber = Number(quantity);
  const validQuantity = /^\d+$/.test(quantity) && Number.isSafeInteger(quantityNumber) && quantityNumber >= minimumOrder && quantityNumber <= product.available_quantity;
  const [enquiring, setEnquiring] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const name = product.translations[language]?.name || product.name;
  const description =
    product.translations[language]?.description || product.translations.en?.description;
  const available = ['available', 'low_stock'].includes(product.status);
  const orderable = product.confirmed && product.category === 'food' && available;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      await rpc('request_submit', {
        product_id: product.id,
        client_key: key.current,
        ...Object.fromEntries(data),
      });
      toast(t('requestSent'));
      onClose();
      navigate('orders');
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={name} onClose={onClose} wide>
      <div className="product-detail-layout">
        <ProductArt product={product} />
        <div>
          <span className="eyebrow">{t(product.category + 'Brand')}</span>
          <h2>
            {name} <small>{product.variant}</small>
          </h2>
          <Badge status={product.status} />
          <div className="detail-price">
            {product.price_cents ? (
              <Money value={product.price_cents} />
            ) : (
              <strong>{t('pricePending')}</strong>
            )}
            <p>{product.sales_unit ? '/ ' + product.sales_unit : t('unitPending')}</p>
          </div>
          {description && <p>{description}</p>}
          <dl className="details-list">
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
                  {product.available_quantity} {product.sales_unit}
                </dd>
              </div>
            )}
            {Object.entries(product.attributes)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{t(k)}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {product.category === 'food' ? (
            <>
              <Field
                label={t('quantity') + ' (minimum 20 cartons)'}
                type="number"
                min={minimumOrder}
                max={product.available_quantity || 1}
                step={1}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onBlur={() => {
                  if (!validQuantity) setQuantity(String(Math.max(minimumOrder, Math.min(product.available_quantity || minimumOrder, Number.isFinite(quantityNumber) ? Math.floor(quantityNumber) || minimumOrder : minimumOrder))));
                }}
              />
              {product.available_quantity < minimumOrder && <p className="muted small-text">Minimum order: 20 cartons. Not enough stock is currently available.</p>}
              <button
                className="button primary full"
                disabled={!orderable || !online || !validQuantity}
                onClick={() => {
                  if (!validQuantity) return;
                  addCart(product, quantityNumber);
                  onClose();
                }}
              >
                <ShoppingBag size={17} />
                {t(orderable ? 'addCart' : 'unavailable')}
              </button>
            </>
          ) : !enquiring ? (
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
              <button className="button primary full" disabled={busy || !online}>
                {t(busy ? 'loading' : 'submit')}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function Cart() {
  const {
    t,
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
  const [fulfilment, setFulfilment] = useState(catalog.settings.pickup ? 'pickup' : 'delivery');
  const [note, setNote] = useState('');
  const key = useRef(crypto.randomUUID());
  const allowed = !!user && user.verification === 'approved' && user.email_verified;
  const changed = cart.some((item) => {
    const p = catalog.products.find((p) => p.id === item.id);
    return (
      !p ||
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
    if (!p || !Number.isSafeInteger(quantity) || quantity < 20) return;
    setCart(cart.map((item) => item.id === id ? { ...item, quantity: Math.min(quantity, Math.max(1, p.available_quantity)) } : item));
    key.current = crypto.randomUUID();
  }
  function adjust(id: string, amount: number) {
    const p = catalog.products.find((p) => p.id === id);
    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(20, Math.min(p?.available_quantity || 20, item.quantity + amount)),
            }
          : item,
      ),
    );
    key.current = crypto.randomUUID();
  }
  async function submit() {
    if (!allowed) {
      setCartOpen(false);
      navigate('account');
      return;
    }
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
      await refreshCatalog();
    } catch (error) {
      notifyError(error);
      if (error instanceof AppError && ['stock_changed', 'price_changed'].includes(error.code))
        await refreshCatalog();
    } finally {
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
            {cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <span className="cart-product-icon">
                  <Package size={24} />
                </span>
                <div className="cart-item-content">
                  <strong>{item.name}</strong>
                  <span>
                    <Money value={item.price_cents} /> / {item.sales_unit}
                  </span>
                  <div className="quantity-stepper">
                    <button
                      aria-label={t('remove')}
                      onClick={() => adjust(item.id, -1)}
                      disabled={busy || item.quantity <= 20}
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      className="cart-quantity-input"
                      type="number"
                      inputMode="numeric"
                      min={20}
                      max={catalog.products.find((p) => p.id === item.id)?.available_quantity || 20}
                      step={1}
                      aria-label={t('quantity') + ' · ' + item.name}
                      value={item.quantity}
                      disabled={busy}
                      onChange={(event) => {
                        if (event.target.value !== '') setCartQuantity(item.id, Number(event.target.value));
                      }}
                    />
                    <button
                      aria-label={t('quantity')}
                      onClick={() => adjust(item.id, 1)}
                      disabled={busy}
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
            ))}
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
                      return p?.price_cents && ['available', 'low_stock'].includes(p.status)
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
          <button
            className="button primary full"
            disabled={
              busy || !online || changed || (!catalog.settings.pickup && !catalog.settings.delivery)
            }
            onClick={() => void submit()}
          >
            {t(busy ? 'loading' : allowed ? 'submitOrder' : 'finishProfile')}
            <ArrowRight size={17} />
          </button>
        </>
      )}
    </Dialog>
  );
}

export function OrdersPage() {
  const { t, user, navigate, notifyError, online } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
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
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('business')}</span>
          <h1>{t('orderHistory')}</h1>
          <p>{t('orderNotice')}</p>
        </div>
        <button
          className="button secondary"
          disabled={!online || loading}
          onClick={() => void load()}
        >
          {t('refresh')}
        </button>
      </div>
      {loading ? (
        <div className="loading-row">{t('loading')}</div>
      ) : error ? (
        <Empty title={t('connectionError')}>
          <button className="button secondary" onClick={() => void load()}>
            {t('retry')}
          </button>
        </Empty>
      ) : !orders.length && !requests.length ? (
        <Empty icon={ShoppingBag} title={t('noOrders')} text={t('noOrdersText')}>
          <button className="button primary" onClick={() => navigate('catalog')}>
            {t('explore')}
            <ArrowRight size={16} />
          </button>
        </Empty>
      ) : (
        <div className="order-grid">
          {orders.map((order) => (
            <button className="order-card panel" key={order.id} onClick={() => setSelected(order)}>
              <div className="order-card-top">
                <span className="round-icon">
                  <ShoppingBag size={20} />
                </span>
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
          {requests.map((request) => (
            <div className="order-card panel" key={request.id}>
              <div className="order-card-top">
                <span className="round-icon">
                  <FileText size={20} />
                </span>
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
          onClose={() => setSelected(null)}
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
            <button
              className="button secondary full danger"
              disabled={busy || !online}
              onClick={async () => {
                setBusy(true);
                try {
                  await rpc('order_cancel', { id: current.id });
                  await load();
                  setSelected(null);
                } catch (error) {
                  notifyError(error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('cancel')}
            </button>
          )}
        </Dialog>
      )}
    </section>
  );
}

export function useAdminProducts(products: Product[]) {
  return products.map(hydrateProduct);
}
