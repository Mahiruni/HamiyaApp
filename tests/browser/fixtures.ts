import type { Page } from '@playwright/test';
const uid = '00000000-0000-4000-8000-000000000002';
export const settings = {
  pickup: true,
  delivery: false,
  delivery_fee_cents: null,
  contact_phone: '',
  contact_email: '',
  pickup_address: 'Test address',
  announcement: { en: '', am: '', om: '' },
};
export const products = [
  {
    id: 'banana',
    name: 'Banana',
    category: 'food',
    variant: 'Hard',
    pack_count: 96,
    price_cents: 71500,
    sales_unit: 'carton',
    confirmed: true,
    stock: 740,
    reserved: 0,
    status: 'available',
    published: true,
    translations: {},
    attributes: {},
    image_path: null,
    created_at: '2026-10-23T00:00:00Z',
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'food',
    variant: 'Hard',
    pack_count: 96,
    price_cents: 71500,
    sales_unit: 'carton',
    confirmed: true,
    stock: 0,
    reserved: 0,
    status: 'available',
    published: true,
    translations: {},
    attributes: {},
    image_path: null,
    created_at: '2026-10-23T00:00:00Z',
  },
];
export const customer = {
  id: uid,
  customer_id: 'HIG-TEST',
  email: 'qa@example.test',
  email_verified: true,
  role: 'customer',
  profile: {
    full_name: 'QA Customer',
    business_name: 'QA Business',
    phone: '+251912345678',
    address: 'Test address',
    city: 'Adama',
    region: 'Oromia',
    landmark: 'Test landmark',
    trade_license: 'TEST',
    consent: true,
  },
  national_mask: '•••• 1234',
  verification: 'approved',
  review_reason: '',
  deletion_requested_at: null,
};
export async function setup(
  page: Page,
  options: {
    signedIn?: boolean;
    role?: string;
    authFailure?: boolean;
    catalogFailure?: boolean;
  } = {},
) {
  const signedIn = options.signedIn !== false;
  const authUser = {
    id: uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'qa@example.test',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00Z',
  };
  await page.addInitScript(
    ({ signedIn, authUser }) => {
      if (!signedIn || localStorage.getItem('qa-initialized')) return;
      localStorage.setItem('qa-initialized', 'true');
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const access_token =
        btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
        '.' +
        btoa(JSON.stringify({ sub: authUser.id, exp, aud: 'authenticated' })) +
        '.test';
      localStorage.setItem(
        'sb-lhdsodqeojxogcwgyjpo-auth-token',
        JSON.stringify({
          access_token,
          refresh_token: 'test-refresh-token',
          token_type: 'bearer',
          expires_at: exp,
          expires_in: 3600,
          user: authUser,
        }),
      );
    },
    { signedIn, authUser },
  );
  const submitted: Record<string, unknown>[] = [];
  const orders: Record<string, unknown>[] = [];
  await page.route('**/*.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname === '/auth/v1/user')
      return json(
        options.authFailure ? { message: 'Service unavailable' } : authUser,
        options.authFailure ? 503 : 200,
      );
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/token')
      return json({
        user: authUser,
        access_token: 'test',
        refresh_token: 'test',
        expires_in: 3600,
      });
    if (url.pathname.endsWith('/hamiya_products'))
      return json(
        options.catalogFailure ? { message: 'Unavailable' } : products,
        options.catalogFailure ? 500 : 200,
      );
    if (url.pathname.endsWith('/hamiya_settings')) return json({ value: settings });
    if (url.pathname.endsWith('/hamiya_orders')) return json(orders);
    if (url.pathname.endsWith('/hamiya_requests')) return json([]);
    if (url.pathname.endsWith('/rpc/hamiya_action')) {
      const { action, payload } = request.postDataJSON();
      if (action === 'me')
        return json({ user: { ...customer, role: options.role || 'customer' }, documents: [] });
      if (action === 'order_submit') {
        submitted.push(payload);
        orders.push({
          id: crypto.randomUUID(),
          customer_id: uid,
          items: payload.items.map((item: Record<string, unknown>) => ({
            ...item,
            product_id: item.id,
            name: 'Banana',
          })),
          status: 'submitted',
          total_cents: 14300000,
          delivery_fee_cents: 0,
          fulfilment: 'pickup',
          address: customer.profile,
          note: '',
          payment_status: 'unpaid',
          created_at: new Date().toISOString(),
        });
        return json({ order: orders.at(-1) });
      }
      if (action === 'admin_dashboard')
        return json({
          products,
          customers: [customer],
          orders,
          requests: [],
          inventory: [],
          audit: [],
          settings,
        });
      return json({ ok: true });
    }
    return json([]);
  });
  return { submitted };
}
