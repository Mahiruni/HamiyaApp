-- Hamiya's additive, transaction-safe Supabase setup. Run on the named project.
-- This is a setup script, not an invented migration-history entry.
begin;
create schema if not exists hamiya_private;
revoke all on schema hamiya_private from public;
grant usage on schema hamiya_private to anon, authenticated;

create table public.hamiya_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 customer_id text not null unique default ('HAM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 profile jsonb not null default '{}', national_last_four text,
 verification text not null default 'draft' check (verification in ('draft','submitted','under_review','approved','corrections_required','rejected','suspended')),
 review_reason text not null default '', deletion_requested_at timestamptz,
 created_at timestamptz not null default now()
);
create table hamiya_private.staff_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','reviewer','inventory')), enabled boolean not null default true
);
create table hamiya_private.identities (
 user_id uuid primary key references auth.users(id) on delete cascade,
 salted_hash text not null, salt text not null
);
create table public.hamiya_documents (
 owner_id uuid not null references public.hamiya_profiles(id) on delete cascade,
 kind text not null check(kind in ('national_id','trade_license','profile_photo')),
 path text not null unique, mime text not null, bytes bigint not null check(bytes>0 and bytes<=8388608),
 created_at timestamptz not null default now(), primary key(owner_id,kind)
);
create table public.hamiya_products (
 id text primary key default gen_random_uuid()::text,
 category text not null check(category in ('food','coffee','vehicles')),
 name text not null, variant text not null default '', pack_count integer check(pack_count>0),
 price_cents bigint check(price_cents>0 and price_cents<=100000000000),
 sales_unit text not null default '', confirmed boolean not null default false,
 stock integer not null default 0 check(stock>=0), reserved integer not null default 0 check(reserved>=0 and reserved<=stock),
 status text not null default 'draft' check(status in ('draft','available','temporarily_unavailable','coming_soon','reserved','sold','archived')),
 published boolean not null default false, low_stock integer not null default 5 check(low_stock>=0),
 translations jsonb not null default '{}', attributes jsonb not null default '{}', original_entry text not null default '', image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not published or status not in ('draft','archived')),
 check(not published or category<>'food' or (confirmed and pack_count is not null and sales_unit<>'' and price_cents is not null))
);
create table public.hamiya_settings (
 id integer primary key check(id=1), value jsonb not null
);
insert into public.hamiya_settings values(1,'{"pickup":true,"delivery":false,"delivery_fee_cents":null,"contact_phone":"","contact_email":"","pickup_address":"","announcement":{"en":"","am":"","om":""}}');
create table public.hamiya_orders (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.hamiya_profiles(id),
 client_key uuid not null, status text not null default 'submitted' check(status in ('submitted','accepted','preparing','ready','completed','rejected','cancelled')),
 items jsonb not null, total_cents bigint not null check(total_cents>0), delivery_fee_cents bigint not null default 0 check(delivery_fee_cents>=0),
 fulfilment text not null check(fulfilment in ('pickup','delivery')), address jsonb not null, note text not null default '',
 payment_status text not null default 'unpaid' check(payment_status='unpaid'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(customer_id,client_key)
);
create table public.hamiya_requests (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.hamiya_profiles(id),
 product_id text not null references public.hamiya_products(id), client_key uuid not null,
 category text not null check(category in ('coffee','vehicles')), details jsonb not null,
 status text not null default 'submitted' check(status in ('submitted','reviewing','quoted','closed','cancelled')),
 quote_cents bigint check(quote_cents>0), quote_unit text not null default '', response text not null default '',
 created_at timestamptz not null default now(), unique(customer_id,client_key)
);
create table public.hamiya_inventory_events (
 id bigint generated always as identity primary key, product_id text not null references public.hamiya_products(id),
 staff_id uuid not null references auth.users(id), quantity integer not null, reason text not null,
 order_id uuid references public.hamiya_orders(id), client_key uuid, created_at timestamptz not null default now(), unique(staff_id,client_key)
);
create table public.hamiya_audit_events (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 action text not null, target text not null, detail text not null default '', created_at timestamptz not null default now()
);
create table public.hamiya_catalog_events (id integer primary key check(id=1), version bigint not null default 1, updated_at timestamptz not null default now());
insert into public.hamiya_catalog_events(id) values(1);
create index hamiya_orders_customer on public.hamiya_orders(customer_id,created_at desc);
create index hamiya_requests_customer on public.hamiya_requests(customer_id,created_at desc);
create index hamiya_requests_product on public.hamiya_requests(product_id);
create index hamiya_inventory_product on public.hamiya_inventory_events(product_id,created_at desc);
create index hamiya_inventory_staff on public.hamiya_inventory_events(staff_id);
create index hamiya_inventory_order on public.hamiya_inventory_events(order_id);
create index hamiya_audit_actor on public.hamiya_audit_events(actor_id);
create index hamiya_products_public on public.hamiya_products(category,created_at desc) where published;

create function hamiya_private.has_role(roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from hamiya_private.staff_roles r where r.user_id=(select auth.uid()) and r.enabled and r.role=any(roles));
$$;
revoke all on function hamiya_private.has_role(text[]) from public;
grant execute on function hamiya_private.has_role(text[]) to anon,authenticated;

alter table public.hamiya_profiles enable row level security;
alter table public.hamiya_documents enable row level security;
alter table public.hamiya_products enable row level security;
alter table public.hamiya_settings enable row level security;
alter table public.hamiya_orders enable row level security;
alter table public.hamiya_requests enable row level security;
alter table public.hamiya_inventory_events enable row level security;
alter table public.hamiya_audit_events enable row level security;
alter table public.hamiya_catalog_events enable row level security;
alter table hamiya_private.staff_roles enable row level security;
alter table hamiya_private.identities enable row level security;
create policy hamiya_identity_no_direct_access on hamiya_private.identities for all to anon,authenticated using(false) with check(false);
create policy hamiya_staff_no_direct_access on hamiya_private.staff_roles for all to anon,authenticated using(false) with check(false);
revoke all on all tables in schema hamiya_private from anon,authenticated;
revoke all on public.hamiya_profiles,public.hamiya_documents,public.hamiya_products,public.hamiya_settings,public.hamiya_orders,public.hamiya_requests,public.hamiya_inventory_events,public.hamiya_audit_events,public.hamiya_catalog_events from anon,authenticated;
grant select on public.hamiya_products,public.hamiya_settings,public.hamiya_catalog_events to anon,authenticated;
grant select on public.hamiya_profiles,public.hamiya_documents,public.hamiya_orders,public.hamiya_requests,public.hamiya_inventory_events,public.hamiya_audit_events to authenticated;
create policy hamiya_profile_read on public.hamiya_profiles for select to authenticated using(id=(select auth.uid()) or (select hamiya_private.has_role(array['admin','reviewer'])));
create policy hamiya_document_read on public.hamiya_documents for select to authenticated using(owner_id=(select auth.uid()) or (select hamiya_private.has_role(array['admin','reviewer'])));
create policy hamiya_catalog_read on public.hamiya_products for select to anon,authenticated using((published and status not in ('draft','archived')) or (select hamiya_private.has_role(array['admin','inventory'])));
create policy hamiya_settings_read on public.hamiya_settings for select to anon,authenticated using(true);
create policy hamiya_order_read on public.hamiya_orders for select to authenticated using(customer_id=(select auth.uid()) or (select hamiya_private.has_role(array['admin','inventory'])));
create policy hamiya_request_read on public.hamiya_requests for select to authenticated using(customer_id=(select auth.uid()) or (select hamiya_private.has_role(array['admin','inventory'])));
create policy hamiya_inventory_read on public.hamiya_inventory_events for select to authenticated using((select hamiya_private.has_role(array['admin','inventory'])));
create policy hamiya_audit_read on public.hamiya_audit_events for select to authenticated using((select hamiya_private.has_role(array['admin'])));
create policy hamiya_catalog_event_read on public.hamiya_catalog_events for select to anon,authenticated using(true);

-- Storage is private for ID, license and profile photographs; product photographs are separate.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('hamiya-documents','hamiya-documents',false,8388608,array['image/jpeg','image/png','application/pdf']),
 ('hamiya-products','hamiya-products',true,8388608,array['image/jpeg','image/png'])
on conflict(id) do nothing;
create policy hamiya_private_upload on storage.objects for insert to authenticated with check(bucket_id='hamiya-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and (storage.foldername(name))[2] in ('national_id','trade_license','profile_photo'));
create policy hamiya_private_read on storage.objects for select to authenticated using(bucket_id='hamiya-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select hamiya_private.has_role(array['admin','reviewer']))));
create policy hamiya_private_delete on storage.objects for delete to authenticated using(bucket_id='hamiya-documents' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.hamiya_documents d where d.path=name));
create policy hamiya_product_upload on storage.objects for insert to authenticated with check(bucket_id='hamiya-products' and (select hamiya_private.has_role(array['admin','inventory'])));
create policy hamiya_product_read on storage.objects for select to anon,authenticated using(bucket_id='hamiya-products');
-- Immutable upload names avoid overwriting an already-reviewed identity document.

create function hamiya_private.complete_profile(uid uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.hamiya_profiles p where p.id=uid and
  coalesce(p.profile->>'full_name','')<>'' and coalesce(p.profile->>'business_name','')<>'' and
  coalesce(p.profile->>'phone','')~'^\+[1-9][0-9]{7,14}$' and coalesce(p.profile->>'region','')<>'' and
  coalesce(p.profile->>'city','')<>'' and coalesce(p.profile->>'address','')<>'' and
  coalesce(p.profile->>'landmark','')<>'' and coalesce(p.profile->>'trade_license','')<>'' and p.profile->>'consent'='true')
 and exists(select 1 from hamiya_private.identities i where i.user_id=uid)
 and (select count(*) from public.hamiya_documents d join storage.objects o on o.bucket_id='hamiya-documents' and o.name=d.path where d.owner_id=uid)=3;
$$;
revoke all on function hamiya_private.complete_profile(uuid) from public;

create function hamiya_private.catalog_changed() returns trigger language plpgsql security invoker set search_path='' as $$
begin update public.hamiya_catalog_events set version=version+1,updated_at=now() where id=1;return null;end;
$$;
revoke all on function hamiya_private.catalog_changed() from public;
create trigger hamiya_catalog_update after insert or update or delete on public.hamiya_products for each statement execute function hamiya_private.catalog_changed();
create trigger hamiya_settings_update after update on public.hamiya_settings for each statement execute function hamiya_private.catalog_changed();

-- All writes run in one Postgres transaction. This private, narrowly granted dispatcher
-- checks the live authenticated user and current staff role for every action.
create function hamiya_private.dispatch(action text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<dispatcher>>
declare
 uid uuid:=auth.uid(); u auth.users%rowtype; me public.hamiya_profiles%rowtype;
 p public.hamiya_products%rowtype; o public.hamiya_orders%rowtype; r public.hamiya_requests%rowtype;
 profile jsonb; filtered jsonb; entry jsonb; item jsonb; snapshot jsonb:='[]';
 settings jsonb; result jsonb; docs jsonb; role_name text; pid text; status text; phone text; national text;
 kind text; object_path text; mime text; salt text; client_key uuid; target uuid; record_id uuid;
 count_pack integer; cents bigint; total bigint:=0; fee bigint:=0; quantity integer; delta integer;
 confirmed boolean; published boolean; category text; sales_unit text;
begin
 if uid is null then raise exception 'sign_in_required';end if;
 if octet_length(payload::text)>65536 then raise exception 'invalid_request';end if;
 select * into u from auth.users where id=uid;
 if not found or u.deleted_at is not null or (u.banned_until is not null and u.banned_until>now()) then raise exception 'sign_in_required';end if;
 insert into public.hamiya_profiles(id,profile) values(uid,jsonb_build_object('full_name',left(coalesce(u.raw_user_meta_data->>'full_name',''),120),'language',case when u.raw_user_meta_data->>'language' in ('en','am','om') then u.raw_user_meta_data->>'language' else 'en' end)) on conflict(id) do nothing;
 select * into me from public.hamiya_profiles where id=uid for update;
 select sr.role into role_name from hamiya_private.staff_roles sr where sr.user_id=uid and sr.enabled;
 role_name:=coalesce(role_name,'customer');
 if me.verification='suspended' and action not in ('me','deletion_request') then raise exception 'account_suspended';end if;

 if action='me' then
  select coalesce(jsonb_agg(to_jsonb(d)-'path'),'[]') into docs from public.hamiya_documents d where owner_id=uid;
  return jsonb_build_object('user',to_jsonb(me)||jsonb_build_object('email',u.email,'email_verified',u.email_confirmed_at is not null,'role',role_name,'national_mask',case when me.national_last_four is null then '' else '•••• '||me.national_last_four end),'documents',docs);
 elsif action='preferences' then
  profile:=me.profile;
  if payload->>'language' in ('en','am','om') then profile:=profile||jsonb_build_object('language',payload->>'language');end if;
  if jsonb_typeof(payload->'marketing')='boolean' then profile:=profile||jsonb_build_object('marketing',payload->'marketing');end if;
  update public.hamiya_profiles set profile=dispatcher.profile where id=uid;
 elsif action='profile_save' then
  select coalesce(jsonb_object_agg(key,value),'{}') into filtered from jsonb_each(payload) where key=any(array['full_name','business_name','business_type','phone','region','city','subcity','woreda','kebele','address','landmark','trade_license','delivery_notes','consent','marketing','location']);
  if exists(select 1 from jsonb_each(filtered) where key not in ('consent','marketing','location') and (jsonb_typeof(value)<>'string' or length(value#>>'{}')>1000)) then raise exception 'invalid_request';end if;
  if filtered?'location' and filtered->'location'<>'null'::jsonb and (jsonb_typeof(filtered->'location'->'lat')<>'number' or jsonb_typeof(filtered->'location'->'lng')<>'number' or abs((filtered->'location'->>'lat')::numeric)>90 or abs((filtered->'location'->>'lng')::numeric)>180) then raise exception 'invalid_request';end if;
  profile:=me.profile||filtered;
  phone:=regexp_replace(coalesce(profile->>'phone',''),'[\s()-]','','g');
  if phone~'^0[0-9]{9}$' then phone:='+251'||substr(phone,2);end if;
  if phone~'^251[0-9]{9}$' then phone:='+'||phone;end if;
  if phone<>'' and phone!~'^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone';end if;
  profile:=profile||jsonb_build_object('phone',phone);
  national:=trim(coalesce(payload->>'national_id',''));
  if national<>'' then
   if length(national)<6 or length(national)>100 then raise exception 'invalid_national_id';end if;
   salt:=gen_random_uuid()::text;
   insert into hamiya_private.identities(user_id,salted_hash,salt) values(uid,encode(sha256(convert_to(salt||national,'UTF8')),'hex'),salt) on conflict(user_id) do update set salted_hash=excluded.salted_hash,salt=excluded.salt;
  end if;
  update public.hamiya_profiles set profile=dispatcher.profile,national_last_four=case when national<>'' then right(national,4) else national_last_four end,
   verification=case when dispatcher.profile is distinct from me.profile or national<>'' then 'draft' else verification end,
   review_reason=case when dispatcher.profile is distinct from me.profile or national<>'' then '' else review_reason end where id=uid;
 elsif action='document_attach' then
  kind:=payload->>'kind';object_path:=payload->>'path';mime:=payload->>'mime';
  if kind not in ('national_id','trade_license','profile_photo') or split_part(object_path,'/',1)<>uid::text or split_part(object_path,'/',2)<>kind or mime not in ('image/jpeg','image/png','application/pdf') or (kind='profile_photo' and mime='application/pdf') then raise exception 'invalid_document';end if;
  if not exists(select 1 from storage.objects so where so.bucket_id='hamiya-documents' and so.name=object_path and so.metadata->>'mimetype'=mime and (so.metadata->>'size')::bigint between 1 and 8388608) then raise exception 'invalid_document';end if;
  insert into public.hamiya_documents(owner_id,kind,path,mime,bytes) select uid,dispatcher.kind,object_path,dispatcher.mime,(so.metadata->>'size')::bigint from storage.objects so where so.bucket_id='hamiya-documents' and so.name=object_path
   on conflict on constraint hamiya_documents_pkey do update set path=excluded.path,mime=excluded.mime,bytes=excluded.bytes,created_at=now();
  update public.hamiya_profiles set verification='draft',review_reason='' where id=uid;
 elsif action='document_access' then
  target:=(payload->>'owner_id')::uuid;
  if target<>uid and role_name not in ('admin','reviewer') then raise exception 'permission_denied';end if;
  select path into object_path from public.hamiya_documents d where d.owner_id=target and d.kind=payload->>'kind';
  if object_path is null then raise exception 'not_found';end if;
  insert into public.hamiya_audit_events(actor_id,action,target) values(uid,'document_view',target::text);
  return jsonb_build_object('path',object_path);
 elsif action='profile_submit' then
  if not hamiya_private.complete_profile(uid) then raise exception 'profile_incomplete';end if;
  update public.hamiya_profiles set verification='submitted',review_reason='' where id=uid;
 elsif action='deletion_request' then
  update public.hamiya_profiles set deletion_requested_at=now() where id=uid;
 elsif action in ('order_submit','request_submit') then
  if u.email_confirmed_at is null then raise exception 'verify_email_first';end if;
  if me.verification<>'approved' or not hamiya_private.complete_profile(uid) then raise exception 'approval_required';end if;
  client_key:=(payload->>'client_key')::uuid;if client_key is null then raise exception 'invalid_request';end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||client_key::text,0));
  if action='request_submit' then
   select * into r from public.hamiya_requests where customer_id=uid and hamiya_requests.client_key=dispatcher.client_key;
   if found then return jsonb_build_object('id',r.id);end if;
   select * into p from public.hamiya_products where id=payload->>'product_id' for share;
   if not found or not p.published or p.category not in ('coffee','vehicles') or p.status not in ('available','coming_soon') then raise exception 'product_unavailable';end if;
   if length(trim(coalesce(payload->>'notes','')))=0 then raise exception 'required_fields';end if;
   insert into public.hamiya_requests(customer_id,product_id,client_key,category,details) values(uid,p.id,client_key,p.category,jsonb_build_object('quantity',left(payload->>'quantity',100),'unit',left(payload->>'unit',100),'destination',left(payload->>'destination',500),'packaging',left(payload->>'packaging',300),'notes',left(payload->>'notes',2000))) returning id into record_id;
  else
   select * into o from public.hamiya_orders where customer_id=uid and hamiya_orders.client_key=dispatcher.client_key;
   if found then return jsonb_build_object('order',to_jsonb(o));end if;
   if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'invalid_request';end if;
   if (select count(distinct value->>'id') from jsonb_array_elements(payload->'items'))<>jsonb_array_length(payload->'items') then raise exception 'invalid_request';end if;
   select value into settings from public.hamiya_settings where id=1;
   if payload->>'fulfilment' not in ('pickup','delivery') or settings->>(payload->>'fulfilment')<>'true' then raise exception 'fulfilment_unavailable';end if;
   if payload->>'fulfilment'='delivery' then if jsonb_typeof(settings->'delivery_fee_cents')<>'number' then raise exception 'fulfilment_unavailable';end if;fee:=(settings->>'delivery_fee_cents')::bigint;end if;
   for entry in select value from jsonb_array_elements(payload->'items') order by value->>'id' loop
    quantity:=(entry->>'quantity')::integer;if quantity is null or quantity not between 1 and 10000 then raise exception 'invalid_request';end if;
    select * into p from public.hamiya_products where id=entry->>'id' for share;
    if not found or p.category<>'food' or not p.published or not p.confirmed or p.status<>'available' or p.stock-p.reserved<quantity then raise exception 'stock_changed';end if;
    if (entry->>'price_cents')::bigint is distinct from p.price_cents or coalesce(entry->>'sales_unit','')<>p.sales_unit then raise exception 'price_changed';end if;
    if p.attributes->>'minimum_order'~'^[0-9]+$' and quantity<(p.attributes->>'minimum_order')::integer then raise exception 'invalid_request';end if;
    total:=total+p.price_cents*quantity;
    snapshot:=snapshot||jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'variant',p.variant,'sales_unit',p.sales_unit,'quantity',quantity,'price_cents',p.price_cents));
   end loop;
   insert into public.hamiya_orders(customer_id,client_key,items,total_cents,delivery_fee_cents,fulfilment,address,note) values(uid,client_key,snapshot,total+fee,fee,payload->>'fulfilment',jsonb_build_object('full_name',me.profile->>'full_name','phone',me.profile->>'phone','address',me.profile->>'address','city',me.profile->>'city','landmark',me.profile->>'landmark','location',me.profile->'location'),left(coalesce(payload->>'note',''),1000)) returning * into o;
   return jsonb_build_object('order',to_jsonb(o));
  end if;
 elsif action='order_cancel' then
  select * into o from public.hamiya_orders where id=(payload->>'id')::uuid and customer_id=uid for update;
  if not found then raise exception 'not_found';end if;
  if o.status='cancelled' then return '{"ok":true}';end if;
  if o.status not in ('submitted','accepted') then raise exception 'invalid_transition';end if;
  if o.status='accepted' then
   for item in select value from jsonb_array_elements(o.items) order by value->>'product_id' loop
    update public.hamiya_products set reserved=reserved-(item->>'quantity')::integer,updated_at=now() where id=item->>'product_id';
   end loop;
  end if;
  update public.hamiya_orders set status='cancelled',updated_at=now() where id=o.id;
 elsif action like 'admin_%' then
  if role_name not in ('admin','reviewer','inventory') then raise exception 'permission_denied';end if;
  if action='admin_dashboard' then
   return jsonb_build_object(
    'products',case when role_name in ('admin','inventory') then (select coalesce(jsonb_agg(to_jsonb(pr) order by pr.created_at),'[]') from public.hamiya_products pr) else '[]'::jsonb end,
    'customers',case when role_name in ('admin','reviewer') then (select coalesce(jsonb_agg(to_jsonb(pr)||jsonb_build_object('email',au.email,'email_verified',au.email_confirmed_at is not null,'role',coalesce(sr.role,'customer'),'national_mask',coalesce('•••• '||pr.national_last_four,''),'documents',(select coalesce(jsonb_agg(d.kind),'[]') from public.hamiya_documents d where d.owner_id=pr.id)) order by pr.created_at desc),'[]') from public.hamiya_profiles pr join auth.users au on au.id=pr.id left join hamiya_private.staff_roles sr on sr.user_id=pr.id and sr.enabled) else '[]'::jsonb end,
    'orders',case when role_name in ('admin','inventory') then (select coalesce(jsonb_agg(to_jsonb(ord) order by ord.created_at desc),'[]') from public.hamiya_orders ord) else '[]'::jsonb end,
    'requests',case when role_name in ('admin','inventory') then (select coalesce(jsonb_agg(to_jsonb(req)||jsonb_build_object('name',pr.name,'customer_contact',cp.profile->>'phone') order by req.created_at desc),'[]') from public.hamiya_requests req join public.hamiya_products pr on pr.id=req.product_id join public.hamiya_profiles cp on cp.id=req.customer_id) else '[]'::jsonb end,
    'inventory',case when role_name in ('admin','inventory') then (select coalesce(jsonb_agg(to_jsonb(ev)||jsonb_build_object('name',pr.name)),'[]') from (select * from public.hamiya_inventory_events order by id desc limit 200) ev join public.hamiya_products pr on pr.id=ev.product_id) else '[]'::jsonb end,
    'audit',case when role_name='admin' then (select coalesce(jsonb_agg(to_jsonb(ev)),'[]') from (select * from public.hamiya_audit_events order by id desc limit 200) ev) else '[]'::jsonb end,
    'settings',(select value from public.hamiya_settings where id=1));
  elsif action='admin_review' then
   if role_name not in ('admin','reviewer') then raise exception 'permission_denied';end if;
   target:=(payload->>'id')::uuid;status:=payload->>'verification';
   if status not in ('under_review','approved','corrections_required','rejected','suspended','submitted') then raise exception 'invalid_request';end if;
   if status in ('corrections_required','rejected','suspended') and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'reason_required';end if;
   if status='approved' and (not hamiya_private.complete_profile(target) or not exists(select 1 from auth.users where id=target and email_confirmed_at is not null)) then raise exception 'profile_incomplete';end if;
   if target=uid or (role_name<>'admin' and exists(select 1 from hamiya_private.staff_roles sr where sr.user_id=target and sr.enabled)) then raise exception 'permission_denied';end if;
   update public.hamiya_profiles set verification=dispatcher.status,review_reason=left(coalesce(payload->>'reason',''),1000) where id=target;
   if not found then raise exception 'not_found';end if;
  elsif action='admin_product' then
   if role_name not in ('admin','inventory') then raise exception 'permission_denied';end if;
   pid:=coalesce(nullif(payload->>'id',''),gen_random_uuid()::text);category:=payload->>'category';status:=payload->>'status';
   select * into p from public.hamiya_products where id=pid for update;
   if category not in ('food','coffee','vehicles') or length(trim(coalesce(payload->>'name','')))=0 then raise exception 'required_fields';end if;
   if p.id is not null and p.category<>category then raise exception 'invalid_request';end if;
   if status not in ('draft','available','temporarily_unavailable','coming_soon','archived','reserved','sold') or (category<>'vehicles' and status in ('reserved','sold')) then raise exception 'invalid_request';end if;
   if category='vehicles' and ((status='reserved' and coalesce(p.stock,0)<>1) or (status='sold' and coalesce(p.stock,0)<>0)) then raise exception 'insufficient_stock';end if;
   count_pack:=(payload->>'pack_count')::integer;cents:=(payload->>'price_cents')::bigint;sales_unit:=left(trim(coalesce(payload->>'sales_unit','')),60);confirmed:=coalesce((payload->>'confirmed')::boolean,false);published:=coalesce((payload->>'published')::boolean,false);
   if category='food' and (confirmed or published) and (not confirmed or count_pack is null or count_pack<1 or cents is null or sales_unit='') then raise exception 'selling_unit_required';end if;
   if published and status in ('draft','archived') then raise exception 'invalid_request';end if;
   if jsonb_typeof(payload->'translations') is distinct from 'object' or jsonb_typeof(payload->'attributes') is distinct from 'object' then raise exception 'invalid_request';end if;
   insert into public.hamiya_products(id,category,name,variant,pack_count,price_cents,sales_unit,confirmed,status,published,translations,attributes)
    values(pid,category,left(trim(payload->>'name'),150),left(coalesce(payload->>'variant',''),60),count_pack,cents,sales_unit,confirmed,status,published,payload->'translations',payload->'attributes')
    on conflict(id) do update set name=excluded.name,variant=excluded.variant,pack_count=excluded.pack_count,price_cents=excluded.price_cents,sales_unit=excluded.sales_unit,confirmed=excluded.confirmed,status=excluded.status,published=excluded.published,translations=excluded.translations,attributes=excluded.attributes,reserved=case when excluded.category='vehicles' then case when excluded.status='reserved' then 1 else 0 end else hamiya_products.reserved end,updated_at=now();
   return jsonb_build_object('id',pid);
  elsif action='admin_stock' then
   if role_name not in ('admin','inventory') then raise exception 'permission_denied';end if;
   client_key:=(payload->>'client_key')::uuid;if client_key is null then raise exception 'invalid_request';end if;
   perform pg_advisory_xact_lock(hashtextextended(uid::text||client_key::text,0));
   if exists(select 1 from public.hamiya_inventory_events ev where ev.staff_id=uid and ev.client_key=dispatcher.client_key) then return '{"ok":true}';end if;
   quantity:=(payload->>'quantity')::integer;
   if quantity is null or quantity not between 1 and 10000000 or payload->>'operation' not in ('add','sale','remove') or length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'reason_required';end if;
   select * into p from public.hamiya_products where id=payload->>'id' for update;if not found then raise exception 'not_found';end if;
   delta:=case when payload->>'operation'='add' then quantity else -quantity end;
   if p.stock+delta<p.reserved then raise exception 'insufficient_stock';end if;
   if p.category='vehicles' and p.stock+delta>1 then raise exception 'one_vehicle_per_listing';end if;
   update public.hamiya_products set stock=stock+delta,status=case when p.category='vehicles' and p.stock+delta=0 and payload->>'operation'='sale' then 'sold' else hamiya_products.status end,updated_at=now() where id=p.id;
   insert into public.hamiya_inventory_events(product_id,staff_id,quantity,reason,client_key) values(p.id,uid,delta,(payload->>'operation')||': '||left(payload->>'reason',500),client_key);
  elsif action='admin_image' then
   if role_name not in ('admin','inventory') then raise exception 'permission_denied';end if;
   object_path:=payload->>'path';if not exists(select 1 from storage.objects so where so.bucket_id='hamiya-products' and so.name=object_path) then raise exception 'invalid_document';end if;
   update public.hamiya_products set image_path=object_path,updated_at=now() where id=payload->>'id';if not found then raise exception 'not_found';end if;
  elsif action='admin_order' then
   if role_name not in ('admin','inventory') then raise exception 'permission_denied';end if;
   select * into o from public.hamiya_orders where id=(payload->>'id')::uuid for update;if not found then raise exception 'not_found';end if;
   status:=payload->>'status';if status=o.status then return '{"ok":true}';end if;
   if not ((o.status='submitted' and status in ('accepted','rejected','cancelled')) or (o.status='accepted' and status in ('preparing','cancelled')) or (o.status='preparing' and status in ('ready','cancelled')) or (o.status='ready' and status in ('completed','cancelled'))) then raise exception 'invalid_transition';end if;
   for item in select value from jsonb_array_elements(o.items) order by value->>'product_id' loop
    select * into p from public.hamiya_products where id=item->>'product_id' for update;quantity:=(item->>'quantity')::integer;
    if status='accepted' then
     if p.stock-p.reserved<quantity or p.status<>'available' or not p.published then raise exception 'insufficient_stock';end if;
     update public.hamiya_products set reserved=reserved+quantity,updated_at=now() where id=p.id;
    elsif status='cancelled' and o.status<>'submitted' then update public.hamiya_products set reserved=reserved-quantity,updated_at=now() where id=p.id;
    elsif status='completed' then
     update public.hamiya_products set stock=stock-quantity,reserved=reserved-quantity,updated_at=now() where id=p.id;
     insert into public.hamiya_inventory_events(product_id,staff_id,quantity,reason,order_id) values(p.id,uid,-quantity,'order_completed',o.id);
    end if;
   end loop;
   update public.hamiya_orders set status=dispatcher.status,updated_at=now() where id=o.id;
  elsif action='admin_request' then
   if role_name not in ('admin','inventory') then raise exception 'permission_denied';end if;
   status:=payload->>'status';cents:=(payload->>'quote_cents')::bigint;
   if status not in ('submitted','reviewing','quoted','closed','cancelled') then raise exception 'invalid_transition';end if;
   if status='quoted' and (cents is null or cents<=0 or length(trim(coalesce(payload->>'quote_unit','')))=0) then raise exception 'selling_unit_required';end if;
   update public.hamiya_requests set status=dispatcher.status,quote_cents=cents,quote_unit=left(coalesce(payload->>'quote_unit',''),100),response=left(coalesce(payload->>'response',''),3000) where id=(payload->>'id')::uuid;if not found then raise exception 'not_found';end if;
  elsif action='admin_settings' then
   if role_name<>'admin' then raise exception 'permission_denied';end if;
   if payload->>'delivery'='true' and (jsonb_typeof(payload->'delivery_fee_cents') is distinct from 'number' or (payload->>'delivery_fee_cents')::bigint<0) then raise exception 'invalid_price';end if;
   settings:=jsonb_build_object('pickup',coalesce((payload->>'pickup')::boolean,false),'delivery',coalesce((payload->>'delivery')::boolean,false),'delivery_fee_cents',(payload->>'delivery_fee_cents')::bigint,'contact_phone',left(coalesce(payload->>'contact_phone',''),40),'contact_email',left(coalesce(payload->>'contact_email',''),254),'pickup_address',left(coalesce(payload->>'pickup_address',''),1000),'announcement',jsonb_build_object('en',left(coalesce(payload->'announcement'->>'en',''),1000),'am',left(coalesce(payload->'announcement'->>'am',''),1000),'om',left(coalesce(payload->'announcement'->>'om',''),1000)));
   update public.hamiya_settings set value=settings where id=1;
  else raise exception 'invalid_request';end if;
 else raise exception 'invalid_request';end if;
 insert into public.hamiya_audit_events(actor_id,action,target,detail) values(uid,action,coalesce(payload->>'id',uid::text),case when action='admin_review' then left(coalesce(payload->>'reason',''),1000) else '' end);
 return coalesce(result,jsonb_build_object('ok',true,'id',record_id));
end;
$$;
revoke all on function hamiya_private.dispatch(text,jsonb) from public;
grant execute on function hamiya_private.dispatch(text,jsonb) to authenticated;
create function public.hamiya_action(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select hamiya_private.dispatch(action,payload); $$;
revoke all on function public.hamiya_action(text,jsonb) from public,anon;
grant execute on function public.hamiya_action(text,jsonb) to authenticated;

insert into public.hamiya_products(id,category,name,variant,pack_count,price_cents,original_entry) values
 ('banana','food','Banana','Hard',96,71500,'1 Banana 96 hard pirce 715'),
 ('energy-ranger','food','Energy Ranger','Hard',78,84500,'2 energy ranger 78 hard pirce 845'),
 ('cappuccino-hard','food','Cappuccino','Hard',60,61500,'3 capucino 60 hard pirce 615'),
 ('cookies','food','Cookies','Softi',60,63000,'4 cookies 60 softi 630'),
 ('vanilla','food','Vanilla','Hard',60,60500,'5 vanilla 60 hard Price 605'),
 ('cappuccino-softi','food','Cappuccino','Softi',null,83000,'6 Cappuccino softi price 830'),
 ('abu-bint','food','Abu Bint','Softi',48,198000,'7 abu bint 48 softi price 1980'),
 ('energy-new','food','Energy New','Hard',80,84500,'8 Energy new 80 hard price 845'),
 ('orange','food','Orange','Hard',96,71500,'9 Orange 96 hard price 715'),
 ('apple','food','Apple','Hard',96,71500,'10 Apple 96 hard price 715'),
 ('mango','food','Mango','Softi',60,78000,'11 mango softi 60 price 780');

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.hamiya_catalog_events,public.hamiya_orders,public.hamiya_requests,public.hamiya_profiles;
 end if;
end $$;
commit;
