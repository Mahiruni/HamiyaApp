import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  a: '00000000-0000-4000-8000-000000000002',
  b: '00000000-0000-4000-8000-000000000003',
  inventory: '00000000-0000-4000-8000-000000000004',
  reviewer: '00000000-0000-4000-8000-000000000005',
};
const bootstrap = `
create role anon; create role authenticated;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',deleted_at timestamptz,banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
alter table storage.objects enable row level security;
grant select,insert,delete,update on storage.objects to authenticated;
grant select on storage.objects to anon;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
`;
test('Supabase schema, permissions and inventory workflows', async (t) => {
  const db = new PGlite();
  await db.exec(bootstrap);
  const schema = await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8');
  await db.exec(
    schema.replace(
      'quantity not between 20 and 10000 then',
      'quantity not between 1 and 10000 then',
    ),
  );
  const minimumMigration = await readFile(
    new URL(
      '../supabase/migrations/20261028014357_enforce_food_carton_minimum.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await db.exec(minimumMigration);
  await db.exec(minimumMigration); // Reapplying cannot change unrelated rules or data.

  async function as(user, fn) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ? ids[user] : '']);
    await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  }
  const call = (action, payload = {}) =>
    db
      .query('select public.hamiya_action($1,$2::jsonb) as data', [action, JSON.stringify(payload)])
      .then((r) => r.rows[0].data);
  for (const [name, id] of Object.entries(ids)) {
    await db.query(
      'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',
      [id, `${name}@example.test`, JSON.stringify({ full_name: name, language: 'en' })],
    );
    await as(name, () => call('me'));
  }
  for (const name of ['admin', 'inventory', 'reviewer'])
    await db.query('insert into hamiya_private.staff_roles(user_id,role) values($1,$2)', [
      ids[name],
      name,
    ]);
  await t.test(
    'preserves all supplied prices and keeps draft stock distinct from pack counts',
    async () => {
      const rows = (await db.query('select * from hamiya_products order by id')).rows;
      assert.equal(rows.length, 11);
      assert.equal(rows.find((r) => r.id === 'banana').price_cents, 71500);
      assert.equal(rows.find((r) => r.id === 'cappuccino-softi').pack_count, null);
      assert(rows.every((r) => r.stock === 0 && !r.published));
      const visible = await as(null, () => db.query('select * from hamiya_products'));
      assert.equal(visible.rows.length, 0);
    },
  );
  await t.test('denies anonymous actions, staff escalation and direct client writes', async () => {
    await assert.rejects(as(null, () => call('me')));
    await assert.rejects(
      as('a', () => call('admin_dashboard')),
      /permission_denied/,
    );
    await assert.rejects(
      as('a', () =>
        db.query("update hamiya_profiles set verification='approved' where id=$1", [ids.a]),
      ),
    );
    await assert.rejects(as('a', () => db.query('select * from hamiya_private.staff_roles')));
  });
  await t.test('requires complete documents and protects another customer’s records', async () => {
    await assert.rejects(
      as('a', () => call('profile_submit')),
      /profile_incomplete/,
    );
    assert.equal(
      (await as('b', () => db.query('select * from hamiya_profiles where id=$1', [ids.a]))).rows
        .length,
      0,
    );
    await assert.rejects(
      as('b', () => call('document_access', { owner_id: ids.a, kind: 'national_id' })),
      /permission_denied/,
    );
  });
  async function complete(name) {
    await as(name, () =>
      call('profile_save', {
        full_name: name,
        business_name: 'Fixture business',
        phone: '0912345678',
        region: 'Oromia',
        city: 'Adama',
        address: 'Fixture address',
        landmark: 'Fixture landmark',
        trade_license: 'TEST-LICENSE',
        national_id: 'TEST-NATIONAL-ID-1234',
        consent: true,
      }),
    );
    for (const kind of ['national_id', 'trade_license', 'profile_photo']) {
      const path = `${ids[name]}/${kind}/fixture.png`;
      await as(name, () =>
        db.query(
          'insert into storage.objects(bucket_id,name,metadata) values(\'hamiya-documents\',$1,\'{"mimetype":"image/png","size":100}\')',
          [path],
        ),
      );
      await as(name, () => call('document_attach', { kind, path, mime: 'image/png' }));
    }
    await as(name, () => call('profile_submit'));
    await as('admin', () => call('admin_review', { id: ids[name], verification: 'approved' }));
  }
  await t.test('completes verification and masks National ID values', async () => {
    await complete('a');
    await complete('b');
    const data = await as('a', () => call('me'));
    assert.equal(data.user.verification, 'approved');
    assert.equal(data.user.profile.phone, '+251912345678');
    assert.equal(data.user.national_mask, '•••• 1234');
    assert(!JSON.stringify(data).includes('TEST-NATIONAL-ID'));
  });
  await t.test(
    'inventory staff cannot access identity files; customers cannot delete reviewed documents',
    async () => {
      const path = `${ids.a}/national_id/fixture.png`;
      assert.equal(
        (
          await as('inventory', () =>
            db.query('select * from storage.objects where name=$1', [path]),
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await as('b', () => db.query('select * from storage.objects where name=$1', [path]))).rows
          .length,
        0,
      );
      assert.equal(
        (
          await as('a', () =>
            db.query('delete from storage.objects where name=$1 returning id', [path]),
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        as('inventory', () => call('document_access', { owner_id: ids.a, kind: 'national_id' })),
        /permission_denied/,
      );
    },
  );
  const product = {
    id: 'banana',
    category: 'food',
    name: 'Banana',
    variant: 'Hard',
    pack_count: 96,
    price_cents: 71500,
    sales_unit: 'carton',
    confirmed: true,
    status: 'available',
    published: true,
    translations: {},
    attributes: {},
  };
  await t.test('publishing requires confirmed units and missing pack counts', async () => {
    await assert.rejects(
      as('admin', () => call('admin_product', { ...product, confirmed: false })),
      /selling_unit_required/,
    );
    await assert.rejects(
      as('admin', () =>
        call('admin_product', { ...product, id: 'cappuccino-softi', pack_count: null }),
      ),
      /selling_unit_required/,
    );
    await as('admin', () => call('admin_product', product));
    await as('admin', () =>
      call('admin_stock', {
        id: 'banana',
        operation: 'add',
        quantity: 250,
        reason: 'Opening stock',
        client_key: crypto.randomUUID(),
      }),
    );
  });
  let orderA, orderB;
  await t.test('rejects stale prices and deduplicates submitted orders', async () => {
    const key = crypto.randomUUID();
    const payload = {
      client_key: key,
      fulfilment: 'pickup',
      items: [{ id: 'banana', quantity: 200, price_cents: 71500, sales_unit: 'carton' }],
    };
    await assert.rejects(
      as('a', () =>
        call('order_submit', { ...payload, items: [{ ...payload.items[0], price_cents: 1 }] }),
      ),
      /price_changed/,
    );
    for (const quantity of [1, 19])
      await assert.rejects(
        as('a', () =>
          call('order_submit', {
            ...payload,
            client_key: crypto.randomUUID(),
            items: [{ ...payload.items[0], quantity }],
          }),
        ),
        /invalid_request/,
      );
    orderA = (await as('a', () => call('order_submit', payload))).order;
    assert.equal((await as('a', () => call('order_submit', payload))).order.id, orderA.id);
    orderB = (
      await as('b', () => call('order_submit', { ...payload, client_key: crypto.randomUUID() }))
    ).order;
    assert.equal(Number(orderA.total_cents), 14300000);
  });
  await t.test('competing accepted orders cannot reserve more than available stock', async () => {
    await as('admin', () => call('admin_order', { id: orderA.id, status: 'accepted' }));
    await assert.rejects(
      as('admin', () => call('admin_order', { id: orderB.id, status: 'accepted' })),
      /insufficient_stock/,
    );
    const p = (await db.query("select * from hamiya_products where id='banana'")).rows[0];
    assert.equal(p.stock, 250);
    assert.equal(p.reserved, 200);
    await assert.rejects(
      as('admin', () =>
        call('admin_stock', {
          id: 'banana',
          operation: 'sale',
          quantity: 100,
          reason: 'Offline sale',
          client_key: crypto.randomUUID(),
        }),
      ),
      /insufficient_stock/,
    );
  });
  await t.test(
    'cancellation releases reservations once; fulfilment deducts once and preserves order prices',
    async () => {
      await as('a', () => call('order_cancel', { id: orderA.id }));
      await as('a', () => call('order_cancel', { id: orderA.id }));
      await as('admin', () => call('admin_order', { id: orderB.id, status: 'accepted' }));
      await as('admin', () => call('admin_product', { ...product, price_cents: 80000 }));
      for (const status of ['preparing', 'ready', 'completed', 'completed'])
        await as('admin', () => call('admin_order', { id: orderB.id, status }));
      const p = (await db.query("select * from hamiya_products where id='banana'")).rows[0];
      assert.equal(p.stock, 50);
      assert.equal(p.reserved, 0);
      const order = (await db.query('select * from hamiya_orders where id=$1', [orderB.id]))
        .rows[0];
      assert.equal(Number(order.total_cents), 14300000);
      assert.equal(
        (await db.query('select * from hamiya_inventory_events where order_id=$1', [orderB.id]))
          .rows.length,
        1,
      );
    },
  );
  await t.test(
    'private profile edits revoke approval; preference changes preserve it',
    async () => {
      await as('a', () => call('preferences', { language: 'am' }));
      assert.equal((await as('a', () => call('me'))).user.verification, 'approved');
      await as('a', () => call('profile_save', { address: 'Changed address' }));
      assert.equal((await as('a', () => call('me'))).user.verification, 'draft');
      await assert.rejects(
        as('a', () => call('order_submit', { client_key: crypto.randomUUID(), items: [] })),
        /approval_required/,
      );
    },
  );
  await t.test('sold individual vehicles cannot receive enquiries', async () => {
    await as('admin', () =>
      call('admin_product', {
        id: 'vehicle-test',
        category: 'vehicles',
        name: 'Fixture vehicle',
        status: 'available',
        published: true,
        confirmed: false,
        pack_count: null,
        price_cents: null,
        sales_unit: '',
        translations: {},
        attributes: {},
      }),
    );
    await as('admin', () =>
      call('admin_stock', {
        id: 'vehicle-test',
        operation: 'add',
        quantity: 1,
        reason: 'Vehicle received',
        client_key: crypto.randomUUID(),
      }),
    );
    await as('admin', () =>
      call('admin_stock', {
        id: 'vehicle-test',
        operation: 'sale',
        quantity: 1,
        reason: 'Vehicle sold',
        client_key: crypto.randomUUID(),
      }),
    );
    await assert.rejects(
      as('b', () =>
        call('request_submit', {
          product_id: 'vehicle-test',
          notes: 'Enquiry',
          client_key: crypto.randomUUID(),
        }),
      ),
      /product_unavailable/,
    );
  });
  await db.close();
});
