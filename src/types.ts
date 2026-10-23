import type { Language } from './i18n';
export type Category = 'food' | 'coffee' | 'vehicles';
export interface Product {
  id: string;
  category: Category;
  name: string;
  variant: string;
  pack_count: number | null;
  price_cents: number | null;
  sales_unit: string;
  confirmed: boolean;
  stock: number;
  reserved: number;
  status: string;
  published: boolean;
  translations: Partial<Record<Language, { name?: string; description?: string }>>;
  attributes: Record<string, string>;
  image_path: string | null;
  image_url?: string | null;
  available_quantity: number;
  created_at: string;
  original_entry?: string;
}
export interface Profile {
  full_name?: string;
  business_name?: string;
  business_type?: string;
  phone?: string;
  region?: string;
  city?: string;
  subcity?: string;
  woreda?: string;
  kebele?: string;
  address?: string;
  landmark?: string;
  trade_license?: string;
  delivery_notes?: string;
  language?: Language;
  consent?: boolean;
  marketing?: boolean;
  location?: { lat: number; lng: number } | null;
}
export interface Customer {
  id: string;
  customer_id: string;
  email: string;
  email_verified: boolean;
  role: 'customer' | 'admin' | 'reviewer' | 'inventory';
  profile: Profile;
  national_mask: string;
  verification: string;
  review_reason: string;
  deletion_requested_at: string | null;
  documents?: string[];
}
export interface DocumentRecord {
  kind: string;
  mime: string;
  bytes: number;
  created_at: string;
}
export interface BusinessSettings {
  pickup: boolean;
  delivery: boolean;
  delivery_fee_cents: number | null;
  contact_phone: string;
  contact_email: string;
  pickup_address: string;
  announcement: Record<Language, string>;
}
export interface Catalog {
  products: Product[];
  settings: BusinessSettings;
}
export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price_cents: number;
  sales_unit: string;
}
export interface OrderItem {
  product_id: string;
  name: string;
  variant: string;
  quantity: number;
  price_cents: number;
  sales_unit: string;
}
export interface Order {
  id: string;
  customer_id: string;
  status: string;
  items: OrderItem[];
  total_cents: number;
  delivery_fee_cents: number;
  fulfilment: string;
  address: Record<string, string>;
  note: string;
  payment_status: string;
  created_at: string;
}
export interface Enquiry {
  id: string;
  product_id: string;
  name?: string;
  category: Category;
  status: string;
  details: Record<string, string>;
  quote_cents: number | null;
  quote_unit: string;
  response: string;
  created_at: string;
}
export interface AuditEvent {
  id: number;
  action?: string;
  target?: string;
  quantity?: number;
  reason?: string;
  name?: string;
  created_at: string;
}
export interface Dashboard {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  requests: Enquiry[];
  inventory: AuditEvent[];
  audit: AuditEvent[];
  settings: BusinessSettings;
}
