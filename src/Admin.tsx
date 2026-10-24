import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Bell,
  ClipboardList,
  FileCheck2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import {
  AppError,
  supabase,
  cents,
  configured,
  hydrateProduct,
  openDocument,
  rpc,
  uploadProductImage,
} from './api';
import { Badge, Dialog, Empty, Field, Money } from './components';
import { languages } from './i18n';
import { useApp } from './state';
import type { BusinessSettings, Customer, Dashboard, Enquiry, Order, Product } from './types';
const empty: Dashboard = {
  products: [],
  customers: [],
  orders: [],
  requests: [],
  inventory: [],
  audit: [],
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
type Tab = 'overview' | 'products' | 'customers' | 'orders' | 'requests' | 'settings' | 'activity';
export default function Admin() {
  const { t, user, navigate, route, notifyError, toast, online, refreshCatalog } = useApp();
  const initialTab = (route.split('/')[1] || 'overview') as Tab;
  const [tab, setTab] = useState<Tab>(['overview','products','customers','orders','requests','settings','activity'].includes(initialTab) ? initialTab : 'overview');
  useEffect(() => {
    const next = route.split('/')[1] || 'overview';
    if (['overview','products','customers','orders','requests','settings','activity'].includes(next)) setTab(next as Tab);
  }, [route]);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Dashboard>(empty);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [request, setRequest] = useState<Enquiry | null>(null);
  const [busy, setBusy] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  async function testTelegram() {
    if (!supabase || telegramTesting) return;
    setTelegramTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('hamiya-telegram-test', { body: {} });
      if (error || !data?.ok) throw new Error(data?.detail || data?.error || error?.message || 'Telegram test failed');
      toast('Telegram test delivered. Check your HAMIYA bot chat.');
    } catch (error) { notifyError(error); }
    finally { setTelegramTesting(false); }
  }
  const [notifications, setNotifications] = useState<{ id: string; order_id: string; created_at: string }[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  async function loadNotifications() {
    if (!supabase || !user || user.role === 'customer') return;
    const [events, receipts] = await Promise.all([
      supabase.from('hamiya_admin_notifications').select('id,order_id,created_at').order('created_at', { ascending: false }).limit(40),
      supabase.from('hamiya_notification_reads').select('notification_id').eq('user_id', user.id),
    ]);
    if (!events.error && !receipts.error) {
      setNotifications(events.data || []);
      setReadIds((receipts.data || []).map((x) => x.notification_id));
    }
  }
  async function openNotification(id: string) {
    if (!supabase || !user) return;
    const { error } = await supabase.from('hamiya_notification_reads').insert({ notification_id: id, user_id: user.id });
    if (error && error.code !== '23505') notifyError(error);
    setReadIds((old) => [...new Set([...old, id])]);
    setTab('orders');
    navigate('admin/orders');
    setNotificationOpen(false);
    void load();
  }
  const knownOrderIds = useRef<Set<string> | null>(null);
  const [unreadOrders, setUnreadOrders] = useState(0);
  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await rpc<Dashboard>('admin_dashboard');
      setData({ ...data, products: data.products.map(hydrateProduct) });
      const ids = new Set(data.orders.map((order) => order.id));
      if (knownOrderIds.current) {
        const newOrders = data.orders.filter((order) => order.status === 'submitted' && !knownOrderIds.current!.has(order.id));
        if (newOrders.length) {
          setUnreadOrders((count) => count + newOrders.length);
          toast(newOrders.length === 1 ? 'New customer order received' : `${newOrders.length} new customer orders received`);
        }
      }
      knownOrderIds.current = ids;
      setFailed(false);
      void loadNotifications();
    } catch (error) {
      if (!silent) notifyError(error);
      if (!silent) setFailed(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }
  useEffect(() => {
    knownOrderIds.current = null;
    setUnreadOrders(0);
    if (!user || user.role === 'customer') return;
    void load();
    void loadNotifications();
    const channel = supabase?.channel('hamiya-admin-notifications-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hamiya_admin_notifications' }, () => { void loadNotifications(); void load(true); })
      .subscribe();
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load(true);
    };
    const interval = window.setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      window.clearInterval(interval);
      if (channel) void supabase?.removeChannel(channel);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [user?.id, user?.role]);
  async function changeOrder(order: Order, status: string) {
    setBusy(true);
    try {
      await rpc('admin_order', { id: order.id, status });
      await load();
      await refreshCatalog();
      toast(t('saved'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  if (!user || user.role === 'customer')
    return (
      <Empty icon={ShieldCheck} title={t('admin')} text={t('permission_denied')}>
        <button className="button secondary" onClick={() => navigate('account')}>
          {t('account')}
          <ArrowRight size={16} />
        </button>
      </Empty>
    );
  const tabs: Tab[] =
    user.role === 'reviewer'
      ? ['overview', 'customers']
      : user.role === 'inventory'
        ? ['overview', 'products', 'orders', 'requests', 'activity']
        : ['overview', 'products', 'customers', 'orders', 'requests', 'settings', 'activity'];
  const transitions: Record<string, string[]> = {
    submitted: ['accepted', 'rejected', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
  };
  return (
    <section className="admin-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('workspace')}</span>
          <h1>{t('admin')}</h1>
          <p>{t('businessHomeText')}</p>
        </div>
        <button
          className="button secondary"
          disabled={loading || !online}
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
          {t('refresh')}
        </button>
      </div>
      {unreadOrders > 0 && (
        <div className="notice" role="status" aria-live="polite">
          <strong>{unreadOrders} new customer order{unreadOrders === 1 ? '' : 's'} received.</strong>{' '}
          <button className="button secondary" onClick={() => { setTab('orders'); navigate('admin/orders'); setUnreadOrders(0); }}>
            View orders <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="admin-notification-area">
        <button className="button secondary" aria-label="Administrator notifications" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen(!notificationOpen); void loadNotifications(); }}>
          <Bell size={18} /> Notifications ({notifications.filter((n) => !readIds.includes(n.id)).length})
        </button>
        {notificationOpen && (
          <div className="panel admin-notification-list">
            <h3>Order notifications</h3>
            {user?.role === 'admin' && <button className="button secondary" disabled={telegramTesting} onClick={() => void testTelegram()}>{telegramTesting ? 'Sending Telegram test…' : 'Send Telegram test'}</button>}
            {notifications.length === 0 && <p className="muted">No new orders yet.</p>}
            {notifications.map((n) => (
              <button key={n.id} className="admin-notification-item" onClick={() => void openNotification(n.id)}>
                <span>{readIds.includes(n.id) ? '✓ ' : '● '}New order #{n.order_id.slice(0, 8).toUpperCase()}</span>
                <small>{new Date(n.created_at).toLocaleString()}</small>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="admin-tabs">
        {tabs.map((value) => (
          <button
            className={tab === value ? 'active' : ''}
            key={value}
            onClick={() => {
              setTab(value);
              navigate(value === 'overview' ? 'admin' : 'admin/' + value);
              setSearch('');
            }}
          >
            {t(value)}
          </button>
        ))}
      </div>
      {['products', 'customers'].includes(tab) && (
        <Field
          label={t(tab === 'customers' ? 'searchCustomers' : 'search')}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      {loading ? (
        <div className="loading-row">{t('loading')}</div>
      ) : failed ? (
        <Empty title={t('connectionError')}>
          <button className="button primary" disabled={!configured} onClick={() => void load()}>
            {t('retry')}
          </button>
        </Empty>
      ) : (
        <>
          {tab === 'overview' && (
            <>
              <div className="metrics-grid">
                {[
                  { key: 'products', value: data.products.length, icon: Package },
                  {
                    key: 'pendingApplications',
                    value: data.customers.filter((c) =>
                      ['submitted', 'under_review'].includes(c.verification),
                    ).length,
                    icon: Users,
                  },
                  {
                    key: 'pendingOrders',
                    value: data.orders.filter((o) => o.status === 'submitted').length,
                    icon: ShoppingBag,
                  },
                ].map(({ key, value, icon: Icon }) => (
                  <div className="metric panel" key={key}>
                    <Icon size={22} />
                    <strong>{value}</strong>
                    <span>{t(key)}</span>
                  </div>
                ))}
              </div>
              <div className="panel admin-welcome">
                <div>
                  <span className="eyebrow">{t('overview')}</span>
                  <h2>{t('businessHome')}</h2>
                  <p>{t('pendingSetup')}</p>
                </div>
                <span className="round-icon">
                  <ClipboardList size={30} />
                </span>
              </div>
              <div className="panel">
                <h3>{t('completedSales')}</h3>
                <Money
                  value={data.orders
                    .filter((o) => o.status === 'completed')
                    .reduce((sum, o) => sum + o.total_cents, 0)}
                />
                <p className="muted small-text">{t('unpaid')}</p>
              </div>
            </>
          )}
          {tab === 'products' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>{t('products')}</h2>
                  <p>{t('pendingSetup')}</p>
                </div>
                <button
                  className="button primary"
                  onClick={() =>
                    setProduct({
                      id: '',
                      category: 'food',
                      name: '',
                      variant: '',
                      pack_count: null,
                      price_cents: null,
                      sales_unit: '',
                      confirmed: false,
                      stock: 0,
                      reserved: 0,
                      status: 'draft',
                      published: false,
                      translations: {},
                      attributes: {},
                      image_path: null,
                      available_quantity: 0,
                      created_at: '',
                    })
                  }
                >
                  <Plus size={16} />
                  {t('newProduct')}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        'productName',
                        'category',
                        'packCount',
                        'price',
                        'stock',
                        'status',
                        'action',
                      ].map((k) => (
                        <th key={k}>{t(k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.products
                      .filter((p) =>
                        `${p.name} ${p.variant} ${p.id}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                            <small>{p.variant}</small>
                          </td>
                          <td>{t(p.category)}</td>
                          <td>{p.pack_count ?? '—'}</td>
                          <td>
                            {p.price_cents ? <Money value={p.price_cents} /> : t('pricePending')}
                            <small>{p.sales_unit || t('unitPending')}</small>
                          </td>
                          <td>
                            {p.stock}
                            <small>
                              {t('reserved')}: {p.reserved}
                            </small>
                          </td>
                          <td>
                            <Badge status={p.status} />
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                className="icon-button"
                                aria-label={t('editProduct')}
                                onClick={() => setProduct(p)}
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                className="button compact secondary"
                                onClick={() => setStock(p)}
                              >
                                {t('manageStock')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === 'customers' &&
            (!data.customers.length ? (
              <Empty icon={Users} title={t('noCustomers')} />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {['customerId', 'businessName', 'email', 'verification', 'action'].map(
                        (k) => (
                          <th key={k}>{t(k)}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers
                      .filter((c) =>
                        `${c.customer_id} ${c.profile.business_name} ${c.profile.full_name} ${c.email} ${c.profile.phone}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td>{c.customer_id}</td>
                          <td>
                            <strong>{c.profile.business_name || c.profile.full_name}</strong>
                            <small>{c.profile.phone}</small>
                            {c.deletion_requested_at && (
                              <small className="danger">{t('deletionRequested')}</small>
                            )}
                          </td>
                          <td>
                            {c.email}
                            <small>{t(c.email_verified ? 'verified' : 'verifyEmail')}</small>
                          </td>
                          <td>
                            <Badge status={c.verification} />
                          </td>
                          <td>
                            <button
                              className="button compact secondary"
                              onClick={() => setCustomer(c)}
                            >
                              {t('reviewCustomer')}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          {tab === 'orders' &&
            (!data.orders.length ? (
              <Empty icon={ShoppingBag} title={t('noOrdersText')} />
            ) : (
              <div className="admin-order-list">
                {data.orders.map((order) => (
                  <div className="panel admin-order" key={order.id}>
                    <div className="order-card-top">
                      <div>
                        <span className="eyebrow">#{order.id.slice(0, 8).toUpperCase()}</span>
                        <h3>{order.address.full_name}</h3>
                        <p>
                          {order.address.phone} · {order.address.address}, {order.address.city}
                        </p>
                      </div>
                      <Badge status={order.status} />
                    </div>
                    <div className="order-lines">
                      {order.items.map((item) => (
                        <div key={item.product_id}>
                          <span>
                            {item.quantity} × {item.name} {item.variant} / {item.sales_unit}
                          </span>
                          <Money value={item.quantity * item.price_cents} />
                        </div>
                      ))}
                    </div>
                    <div className="order-card-bottom">
                      <strong>
                        <Money value={order.total_cents} />
                      </strong>
                      <span>
                        {t(order.fulfilment)} · {t('unpaid')}
                      </span>
                    </div>
                    {order.note && <p>{order.note}</p>}
                    <div className="admin-order-actions">
                      {(transitions[order.status] || []).map((status) => (
                        <button
                          key={status}
                          className={
                            'button compact ' +
                            (status === 'cancelled' || status === 'rejected'
                              ? 'secondary'
                              : 'primary')
                          }
                          disabled={busy || !online}
                          onClick={() => void changeOrder(order, status)}
                        >
                          {t(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          {tab === 'requests' &&
            (!data.requests.length ? (
              <Empty icon={FileCheck2} title={t('noData')} />
            ) : (
              <div className="order-grid">
                {data.requests.map((r) => (
                  <div className="panel order-card" key={r.id}>
                    <Badge status={r.status} />
                    <h3>{r.name || t(r.category)}</h3>
                    <p>{r.details.notes}</p>
                    <p>
                      {r.details.quantity} {r.details.unit} · {r.details.destination}
                    </p>
                    {r.quote_cents && (
                      <p>
                        <Money value={r.quote_cents} /> / {r.quote_unit}
                      </p>
                    )}
                    <button className="button secondary" onClick={() => setRequest(r)}>
                      {t('update')}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          {tab === 'settings' && <Settings settings={data.settings} onSaved={load} />}{' '}
          {tab === 'activity' && (
            <div className="panel">
              <h2>{t('activity')}</h2>
              {!data.inventory.length && !data.audit.length ? (
                <p>{t('noActivity')}</p>
              ) : (
                <div className="activity-list">
                  {[...data.inventory, ...data.audit]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 200)
                    .map((event, i) => (
                      <div className="activity-row" key={i}>
                        <span className="activity-dot" />
                        <div>
                          <strong>{event.name || t(event.action || 'activity')}</strong>
                          <p>
                            {event.quantity !== undefined
                              ? `${event.quantity > 0 ? '+' : ''}${event.quantity} · ${event.reason}`
                              : event.target}
                          </p>
                        </div>
                        <small>{new Date(event.created_at).toLocaleString()}</small>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {product && (
        <ProductEditor
          product={product}
          onClose={() => setProduct(null)}
          onSaved={async () => {
            setProduct(null);
            await load();
            await refreshCatalog();
          }}
        />
      )}
      {stock && (
        <StockEditor
          product={stock}
          onClose={() => setStock(null)}
          onSaved={async () => {
            setStock(null);
            await load();
            await refreshCatalog();
          }}
        />
      )}
      {customer && (
        <CustomerReview
          customer={customer}
          onClose={() => setCustomer(null)}
          onSaved={async () => {
            setCustomer(null);
            await load();
          }}
        />
      )}
      {request && (
        <RequestEditor
          request={request}
          onClose={() => setRequest(null)}
          onSaved={async () => {
            setRequest(null);
            await load();
          }}
        />
      )}
    </section>
  );
}
function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, notifyError, toast, online } = useApp();
  const [form, setForm] = useState(product);
  const [price, setPrice] = useState(
    product.price_cents !== null ? (product.price_cents / 100).toFixed(2) : '',
  );
  const [busy, setBusy] = useState(false);
  const specs =
    form.category === 'food'
      ? ['minimum_order']
      : form.category === 'coffee'
        ? ['origin', 'grade', 'processing', 'form', 'packaging', 'minimum_order']
        : ['make', 'model', 'year', 'condition', 'mileage', 'power', 'transmission', 'location'];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await rpc('admin_product', {
        ...form,
        id: form.id || undefined,
        status: ['low_stock', 'out_of_stock'].includes(form.status) ? 'available' : form.status,
        price_cents: cents(price),
      });
      await onSaved();
      toast(t('saved'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t(product.id ? 'editProduct' : 'newProduct')} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field
            label={t('productName')}
            value={form.name}
            required
            maxLength={150}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <label className="field">
            <span>{t('category')}</span>
            <select
              value={form.category}
              disabled={!!product.id}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value as Product['category'] }))
              }
            >
              {['food', 'coffee', 'vehicles'].map((category) => (
                <option key={category} value={category}>
                  {t(category)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t('variant')}
            value={form.variant}
            onChange={(e) => setForm((p) => ({ ...p, variant: e.target.value }))}
          />
          <Field
            label={t('packCount')}
            type="number"
            min={1}
            step={1}
            value={form.pack_count ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, pack_count: e.target.value ? Number(e.target.value) : null }))
            }
          />
          <Field
            label={t('priceBirr')}
            value={price}
            inputMode="decimal"
            onChange={(e) => setPrice(e.target.value)}
          />
          <Field
            label={t('salesUnit')}
            value={form.sales_unit}
            onChange={(e) => setForm((p) => ({ ...p, sales_unit: e.target.value }))}
          />
          <label className="field">
            <span>{t('productStatus')}</span>
            <select
              value={
                form.status === 'low_stock' || form.status === 'out_of_stock'
                  ? 'available'
                  : form.status
              }
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            >
              {[
                'draft',
                'available',
                'temporarily_unavailable',
                'coming_soon',
                'archived',
                ...(form.category === 'vehicles' ? ['reserved', 'sold'] : []),
              ].map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.confirmed}
            onChange={(e) => setForm((p) => ({ ...p, confirmed: e.target.checked }))}
          />
          {t('confirmed')}
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))}
          />
          {t('published')}
        </label>
        <div className="notice">{t('openingStock')}</div>
        <h3>{t('translations')}</h3>
        <div className="translations-grid">
          {languages.map((language) => (
            <fieldset key={language.code}>
              <legend>{language.label}</legend>
              <Field
                label={t('productName')}
                value={form.translations[language.code]?.name || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    translations: {
                      ...p.translations,
                      [language.code]: { ...p.translations[language.code], name: e.target.value },
                    },
                  }))
                }
              />
              <label className="field">
                <span>{t('description')}</span>
                <textarea
                  rows={3}
                  value={form.translations[language.code]?.description || ''}
                  maxLength={3000}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      translations: {
                        ...p.translations,
                        [language.code]: {
                          ...p.translations[language.code],
                          description: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </label>
            </fieldset>
          ))}
        </div>
        <h3>{t('specifications')}</h3>
        <div className="form-grid">
          {specs.map((key) => (
            <Field
              key={key}
              label={t(key)}
              value={form.attributes[key] || ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, attributes: { ...p.attributes, [key]: e.target.value } }))
              }
            />
          ))}
        </div>
        {product.id && (
          <label className="button secondary">
            {t('photo')}
            <input
              type="file"
              className="visually-hidden"
              accept="image/png,image/jpeg"
              disabled={busy || !online}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  await uploadProductImage(file, product.id);
                  toast(t('uploaded'));
                } catch (error) {
                  notifyError(error);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="button primary" disabled={busy || !online}>
            {t(busy ? 'loading' : 'save')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function StockEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, notifyError, toast, online } = useApp();
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const [targetStock, setTargetStock] = useState(String(product.stock));
  const [reason, setReason] = useState('Inventory count correction');
  const delta = Number(targetStock) - product.stock;
  const validTarget = /^\\d+$/.test(targetStock) && Number.isSafeInteger(Number(targetStock)) && Number(targetStock) <= 10000000 && Number(targetStock) >= product.reserved;
  async function saveQuantity(e: FormEvent) {
    e.preventDefault();
    if (!validTarget || delta === 0) return;
    setBusy(true);
    try {
      await rpc('admin_stock', {
        id: product.id,
        client_key: key.current,
        operation: delta > 0 ? 'add' : 'remove',
        quantity: Math.abs(delta),
        reason: reason.trim() || 'Inventory count correction',
      });
      await onSaved();
      toast(t('saved'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={t('manageStock') + ' · ' + product.name} onClose={onClose}>
      <div className="stock-summary">
        <div>
          <span>{t('stock')}</span>
          <strong>{product.stock}</strong>
        </div>
        <div>
          <span>{t('reserved')}</span>
          <strong>{product.reserved}</strong>
        </div>
      </div>
      <form onSubmit={saveQuantity} className="stock-direct-edit">
        <Field label="Set total stock (cartons)" type="number" min={product.reserved} max={10000000} step={1} required value={targetStock} onChange={(e) => setTargetStock(e.target.value)} />
        <Field label={t('reason')} value={reason} maxLength={500} required onChange={(e) => setReason(e.target.value)} />
        <p className="muted small-text">{validTarget ? (delta === 0 ? 'No stock change' : `${delta > 0 ? '+' : ''}${delta} cartons will be recorded in inventory history.`) : `Enter a whole number of at least ${product.reserved} reserved cartons.`}</p>
        <button className="button primary full" disabled={busy || !online || !validTarget || delta === 0}>Save stock quantity</button>
      </form>
      <div className="notice">Or record a separate stock movement below.</div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const input = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          try {
            await rpc('admin_stock', {
              id: product.id,
              client_key: key.current,
              ...input,
              quantity: Number(input.quantity),
            });
            await onSaved();
            toast(t('saved'));
          } catch (error) {
            notifyError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>{t('stockAction')}</span>
          <select name="operation">
            {[
              ['add', 'addStock'],
              ['sale', 'recordSale'],
              ['remove', 'removeStock'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={t('quantity')}
          type="number"
          name="quantity"
          min={1}
          max={10000000}
          step={1}
          required
        />
        <Field label={t('reason')} name="reason" maxLength={500} required />
        <button className="button primary full" disabled={busy || !online}>
          {t(busy ? 'loading' : 'save')}
        </button>
      </form>
    </Dialog>
  );
}
function CustomerReview({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, notifyError, toast, online } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={t('reviewCustomer')} onClose={onClose}>
      <Badge status={customer.verification} />
      <h3>{customer.profile.business_name || customer.profile.full_name}</h3>
      <dl className="details-list">
        {Object.entries(customer.profile)
          .filter(([key]) => !['location', 'consent', 'marketing'].includes(key))
          .map(([key, value]) => (
            <div key={key}>
              <dt>
                {t(
                  (
                    {
                      full_name: 'fullName',
                      business_name: 'businessName',
                      business_type: 'businessType',
                      trade_license: 'tradeLicense',
                      delivery_notes: 'deliveryNotes',
                    } as Record<string, string>
                  )[key] || key,
                )}
              </dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        <div>
          <dt>{t('nationalId')}</dt>
          <dd>{customer.national_mask}</dd>
        </div>
        <div>
          <dt>{t('email')}</dt>
          <dd>{customer.email}</dd>
        </div>
      </dl>
      <div className="document-checks">
        {(customer.documents || []).map((kind) => (
          <button
            type="button"
            className="button secondary compact"
            key={kind}
            onClick={() => void openDocument(customer.id, kind).catch(notifyError)}
          >
            <FileCheck2 size={16} />
            {t(
              (
                {
                  national_id: 'nationalDocument',
                  trade_license: 'licenseDocument',
                  profile_photo: 'profilePhoto',
                } as Record<string, string>
              )[kind],
            )}
          </button>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await rpc('admin_review', {
              id: customer.id,
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
            await onSaved();
            toast(t('saved'));
          } catch (error) {
            notifyError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>{t('verification')}</span>
          <select
            name="verification"
            defaultValue={
              customer.verification === 'draft' ? 'under_review' : customer.verification
            }
          >
            {[
              'under_review',
              'approved',
              'corrections_required',
              'rejected',
              'suspended',
              'submitted',
            ].map((status) => (
              <option key={status} value={status}>
                {t(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('reason')}</span>
          <textarea name="reason" rows={3} maxLength={1000} defaultValue={customer.review_reason} />
        </label>
        <button className="button primary full" disabled={busy || !online}>
          {t(busy ? 'loading' : 'save')}
        </button>
      </form>
    </Dialog>
  );
}
function RequestEditor({
  request,
  onClose,
  onSaved,
}: {
  request: Enquiry;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, notifyError, toast, online } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={request.name || t('enquiry')} onClose={onClose}>
      <p>{request.details.notes}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const values = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          try {
            await rpc('admin_request', {
              id: request.id,
              ...values,
              quote_cents: cents(String(values.price)),
            });
            await onSaved();
            toast(t('saved'));
          } catch (error) {
            notifyError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>{t('status')}</span>
          <select name="status" defaultValue={request.status}>
            {['submitted', 'reviewing', 'quoted', 'closed', 'cancelled'].map((status) => (
              <option key={status} value={status}>
                {t(status)}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <Field
            label={t('quotePrice')}
            name="price"
            inputMode="decimal"
            defaultValue={request.quote_cents ? (request.quote_cents / 100).toFixed(2) : ''}
          />
          <Field label={t('quoteUnit')} name="quote_unit" defaultValue={request.quote_unit} />
        </div>
        <label className="field">
          <span>{t('response')}</span>
          <textarea rows={4} name="response" maxLength={3000} defaultValue={request.response} />
        </label>
        <button className="button primary full" disabled={busy || !online}>
          {t(busy ? 'loading' : 'save')}
        </button>
      </form>
    </Dialog>
  );
}
function Settings({
  settings,
  onSaved,
}: {
  settings: BusinessSettings;
  onSaved: () => Promise<void>;
}) {
  const { t, notifyError, toast, online } = useApp();
  const [form, setForm] = useState(settings);
  const [fee, setFee] = useState(
    settings.delivery_fee_cents === null ? '' : (settings.delivery_fee_cents / 100).toFixed(2),
  );
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel">
      <h2>{t('settings')}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const amount = cents(fee);
            if (form.delivery && amount === null) throw new AppError('invalid_price');
            await rpc('admin_settings', { ...form, delivery_fee_cents: amount });
            await onSaved();
            toast(t('saved'));
          } catch (error) {
            notifyError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <Field
            label={t('contactPhone')}
            type="tel"
            value={form.contact_phone}
            onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
          />
          <Field
            label={t('contactEmail')}
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
          />
          <div className="full-span">
            <Field
              label={t('pickupAddress')}
              value={form.pickup_address}
              onChange={(e) => setForm((p) => ({ ...p, pickup_address: e.target.value }))}
            />
          </div>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.pickup}
            onChange={(e) => setForm((p) => ({ ...p, pickup: e.target.checked }))}
          />
          {t('allowPickup')}
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.delivery}
            onChange={(e) => setForm((p) => ({ ...p, delivery: e.target.checked }))}
          />
          {t('allowDelivery')}
        </label>
        <Field
          label={t('deliveryFee')}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          inputMode="decimal"
          required={form.delivery}
        />
        <h3>{t('announcement')}</h3>
        {languages.map((language) => (
          <label className="field" key={language.code}>
            <span>{language.label}</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={form.announcement[language.code]}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  announcement: { ...p.announcement, [language.code]: e.target.value },
                }))
              }
            />
          </label>
        ))}
        <button className="button primary" disabled={busy || !online}>
          {t(busy ? 'loading' : 'save')}
        </button>
      </form>
    </div>
  );
}
