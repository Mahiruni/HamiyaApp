import { createClient } from '@supabase/supabase-js';
import { boundedFetch, withTimeout } from './async';
import { authStorage } from './auth-storage';
import { projectUrl, projectPublishableKey } from './project';
import { foodAvailability } from './catalog';
import type { Catalog, Product, Customer, DocumentRecord } from './types';
const env = import.meta.env;
export const supabaseUrl = env.VITE_SUPABASE_URL || projectUrl;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_URL !== projectUrl ? '' : projectPublishableKey);
export const configured =
  !!key && (key.startsWith('sb_publishable_') || key.split('.').length === 3);
// A missing public key produces an honest setup state, never a fake backend.
export const supabase = configured
  ? createClient(supabaseUrl, key, {
      global: { fetch: boundedFetch },
      auth: {
        flowType: 'pkce',
        persistSession: true,
        storage: authStorage,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
function check<T>(
  result: { data: T; error: null } | { data: unknown; error: { message: string; code?: string } },
): T {
  if (result.error) {
    const message = result.error.message;
    const codes = [
      'permission_denied',
      'profile_incomplete',
      'verify_email_first',
      'approval_required',
      'invalid_phone',
      'invalid_national_id',
      'invalid_document',
      'stock_changed',
      'price_changed',
      'product_unavailable',
      'insufficient_stock',
      'invalid_transition',
      'reason_required',
      'selling_unit_required',
      'required_fields',
      'fulfilment_unavailable',
      'invalid_price',
      'invalid_request',
      'not_found',
      'account_suspended',
      'one_vehicle_per_listing',
      'sign_in_required',
    ];
    throw new AppError(
      codes.find((code) => message.includes(code)) ||
        (message.includes('Email not confirmed')
          ? 'verify_email_first'
          : message.includes('Invalid login')
            ? 'invalid_credentials'
            : message.includes('rate limit')
              ? 'too_many_attempts'
              : message.includes('already registered')
                ? 'email_exists'
                : message.includes('fetch')
                  ? 'connectionError'
                  : 'server_error'),
    );
  }
  return result.data;
}
export async function rpc<T = Record<string, unknown>>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  if (!supabase) throw new AppError('servicePending');
  return check(await withTimeout(supabase.rpc('hamiya_action', { action, payload }), 20000)) as T;
}
export function hydrateProduct(p: Product): Product {
  return {
    ...p,
    available_quantity: p.stock - p.reserved,
    status: foodAvailability(p),
    image_url: p.image_path
      ? `${supabaseUrl}/storage/v1/object/public/hamiya-products/${p.image_path}`
      : null,
  };
}
export async function loadCatalog(): Promise<Catalog> {
  if (!supabase) throw new AppError('servicePending');
  const [products, settings] = await Promise.all([
    supabase
      .from('hamiya_products')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false }),
    supabase.from('hamiya_settings').select('value').eq('id', 1).single(),
  ]);
  return {
    products: (check(products) || []).map(hydrateProduct),
    settings: check(settings)?.value,
  };
}
export async function currentProfile(): Promise<{
  user: Customer | null;
  documents: DocumentRecord[];
}> {
  if (!supabase) return { user: null, documents: [] };
  const { data, error } = await supabase.auth.getUser();
  if (
    error &&
    error.name !== 'AuthSessionMissingError' &&
    error.status !== 401 &&
    error.status !== 403
  )
    throw new AppError('connectionError');
  if (error || !data.user) return { user: null, documents: [] };
  return rpc('me');
}
export async function authenticate(
  mode: 'login' | 'register',
  input: { email: string; password: string; full_name?: string; language?: string },
) {
  if (!supabase) throw new AppError('servicePending');
  if (mode === 'register') {
    if (input.password.length < 12) throw new AppError('invalid_registration');
    const data = check(
      await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.full_name, language: input.language },
          emailRedirectTo: window.location.origin + '/#account',
        },
      }),
    );
    if (!data.session) return { user: null, confirmation: true };
  } else
    check(await supabase.auth.signInWithPassword({ email: input.email, password: input.password }));
  const data = await currentProfile();
  return { ...data, confirmation: false };
}
export async function uploadDocument(file: File, kind: string) {
  if (!supabase) throw new AppError('servicePending');
  if (!['profile_photo', 'national_id', 'trade_license'].includes(kind))
    throw new AppError('invalid_document');
  await validateUpload(file, kind === 'profile_photo');
  const user = check(await supabase.auth.getUser()).user;
  if (!user) throw new AppError('sign_in_required');
  const previous = await supabase
    .from('hamiya_documents')
    .select('path')
    .eq('owner_id', user.id)
    .eq('kind', kind)
    .maybeSingle();
  if (previous.error) throw previous.error;
  const extension =
    file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${user.id}/${kind}/${crypto.randomUUID()}.${extension}`;
  check(
    await supabase.storage
      .from('hamiya-documents')
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '0' }),
  );
  try {
    await rpc('document_attach', { kind, path, mime: file.type });
    if (previous.data?.path)
      await supabase.storage.from('hamiya-documents').remove([previous.data.path]);
  } catch (error) {
    await supabase.storage.from('hamiya-documents').remove([path]);
    throw error;
  }
}
export async function openDocument(owner: string, kind: string) {
  if (!supabase) throw new AppError('servicePending');
  const { path } = await rpc<{ path: string }>('document_access', { owner_id: owner, kind });
  const data = check(
    await supabase.storage.from('hamiya-documents').createSignedUrl(path, 60, { download: true }),
  );
  if (!data) throw new AppError('not_found');
  const link = document.createElement('a');
  link.href = data.signedUrl;
  link.rel = 'noopener noreferrer';
  link.target = '_blank';
  link.click();
}
export async function uploadProductImage(file: File, id: string) {
  if (!supabase) throw new AppError('servicePending');
  await validateUpload(file, true);
  const path = `${id}/${crypto.randomUUID()}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
  check(
    await supabase.storage
      .from('hamiya-products')
      .upload(path, file, { contentType: file.type, upsert: false }),
  );
  await rpc('admin_image', { id, path });
}
async function validateUpload(file: File, photo = false) {
  if (file.size === 0) throw new AppError('invalid_document');
  if (file.size > 8 * 1024 * 1024) throw new AppError('file_too_large');
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const pdf = String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (!(
    (png && file.type === 'image/png') ||
    (jpeg && file.type === 'image/jpeg') ||
    (!photo && pdf && file.type === 'application/pdf')
  ))
    throw new AppError('invalid_document');
}
export function cents(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new AppError('invalid_price');
  const [whole, decimal = ''] = value.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result < 0) throw new AppError('invalid_price');
  return result;
}
export async function submissionKey(scope: string, payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  const storageKey = 'hamiya-submit-' + scope;
  try {
    const previous = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (previous?.hash === hash && typeof previous.key === 'string') return previous.key;
    const key = crypto.randomUUID();
    localStorage.setItem(storageKey, JSON.stringify({ hash, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}
export function clearSubmissionKey(scope: string) {
  try {
    localStorage.removeItem('hamiya-submit-' + scope);
  } catch {
    /* Storage may be disabled. */
  }
}
