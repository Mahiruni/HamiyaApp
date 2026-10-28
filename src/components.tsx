import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';
import {
  Apple,
  Banana,
  CarFront,
  Coffee,
  Cookie,
  Flame,
  Flower2,
  Leaf,
  Package,
  Plus,
  ArrowRight,
  Wheat,
  X,
  ArrowUpRight,
  LoaderCircle,
} from 'lucide-react';
import { useApp } from './state';
import { useOverlay } from './experience';
import type { Category, Product } from './types';
import { divisionArtwork, unitLabel, variantLabel } from './storefront';
export const categoryIcons = { food: Wheat, coffee: Coffee, vehicles: CarFront };

export function DivisionBanner({ category }: { category: Category }) {
  const { t } = useApp();
  return (
    <div className={'division-banner ' + category}>
      <div>
        <strong>{t(category + 'Brand')}</strong>
        <p>{t(category + 'Desc')}</p>
      </div>
      <img src={divisionArtwork(category)} alt="" width={240} height={180} decoding="async" />
    </div>
  );
}

export function ProductCard({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: (product: Product) => void;
}) {
  const { t, language } = useApp();
  const name = product.translations[language]?.name || product.name;
  return (
    <button
      className="product-card"
      data-category={product.category}
      onClick={() => onOpen(product)}
      aria-label={t('details') + ': ' + name}
    >
      <ProductArt product={product} />
      <div className="product-content">
        <div className="product-title-row">
          <span className="product-variant">
            {variantLabel(product.variant, t) || t(product.category)}
          </span>
          <Badge status={product.status} />
        </div>
        <h3>{name}</h3>
        <p>
          {product.pack_count
            ? `${product.pack_count} · ${t('pack')}`
            : t(product.category + 'Brand')}
        </p>
        <div className="product-price-row">
          <div>
            {product.price_cents ? (
              <Money value={product.price_cents} compact />
            ) : (
              <strong>{t('pricePending')}</strong>
            )}
            <small>
              {product.sales_unit ? '/ ' + unitLabel(product.sales_unit, t) : t('unitPending')}
            </small>
          </div>
          <span className="product-arrow" aria-hidden="true">
            {product.category === 'food' ? <Plus size={20} /> : <ArrowRight size={18} />}
          </span>
        </div>
        {product.category === 'food' && (
          <small className="product-minimum">{t('minimumCartons')}</small>
        )}
      </div>
    </button>
  );
}

export function HamiyaMark({
  size = 'md',
  label,
}: {
  size?: 'tiny' | 'sm' | 'md';
  label?: string;
}) {
  return (
    <span className={'hamiya-mark hamiya-mark-' + size} aria-hidden={label ? undefined : true}>
      <img
        src="/brand/hamiya-food-icon-192.png"
        alt={label || ''}
        width={48}
        height={48}
        decoding="async"
      />
    </span>
  );
}

export function FoodBrandMark({
  alt = 'Hamiya Food Processing',
  className = '',
}: {
  alt?: string;
  className?: string;
}) {
  return (
    <span className={'food-brand-mark ' + className}>
      <img
        src="/brand/hamiya-food-processing.jpg"
        alt={alt}
        width={240}
        height={240}
        loading="lazy"
      />
    </span>
  );
}

export function Money({
  value,
  compact = false,
}: {
  value: number | null | undefined;
  compact?: boolean;
}) {
  const { language } = useApp();
  return (
    <span className="money">
      {new Intl.NumberFormat(language + '-ET', {
        minimumFractionDigits: compact ? 0 : 2,
        maximumFractionDigits: 2,
      }).format((value || 0) / 100)}{' '}
      <small>ETB</small>
    </span>
  );
}
export function Badge({ status }: { status: string }) {
  const { t } = useApp();
  return (
    <span className={'badge ' + status}>
      <span />
      {t(status)}
    </span>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useOverlay(true, onClose);
  useEffect(() => {
    ref.current?.showModal();
    return () => {
      ref.current?.close();
    };
  }, []);
  const { t } = useApp();
  return (
    <dialog
      ref={ref}
      className={'dialog ' + (wide ? 'wide' : '')}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button className="icon-button" aria-label={t('close')} onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { t } = useApp();
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && <b aria-label={t('required')}> *</b>}
      </span>
      <input id={id} aria-describedby={hint ? id + '-hint' : undefined} {...props} />
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </label>
  );
}
export function Button({
  busy = false,
  children,
  disabled,
  className = 'button primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  const { t } = useApp();
  return (
    <button className={className} disabled={disabled || busy} aria-busy={busy} {...props}>
      {busy && <LoaderCircle className="spinner" size={18} aria-hidden="true" />}
      {busy ? t('loading') : children}
    </button>
  );
}

export function LoadingState() {
  const { t } = useApp();
  const expired = useLoadingTimeout();
  return (
    <div className="loading-state" role="status">
      {expired ? (
        <div className="loading-recovery" role="alert">
          <p>{t('screenLoadFailed')}</p>
          <button className="button secondary" onClick={() => window.location.reload()}>
            {t('retry')}
          </button>
        </div>
      ) : (
        <>
          <LoaderCircle className="spinner" size={24} aria-hidden="true" />
          <span>{t('loading')}</span>
        </>
      )}
    </div>
  );
}

function useLoadingTimeout() {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), 20000);
    return () => clearTimeout(timer);
  }, []);
  return expired;
}

export function StartupSplash({
  failed = false,
  onRetry,
}: {
  failed?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useApp();
  const expired = useLoadingTimeout();
  const recovery = failed || expired;
  return (
    <div className="startup-splash" role="status">
      <img
        src="/brand/hamiya-food-icon-192.png"
        alt=""
        width={88}
        height={88}
        fetchPriority="high"
      />
      <strong>HAMIYA</strong>
      <span>{t('groupName')}</span>
      {recovery ? (
        <div className="startup-recovery" role="alert">
          <p>{t(failed ? 'startupFailed' : 'screenLoadFailed')}</p>
          <button
            className="button secondary"
            onClick={onRetry || (() => window.location.reload())}
          >
            {t('retry')}
          </button>
        </div>
      ) : (
        <span className="startup-progress" aria-hidden="true" />
      )}
      {!recovery && <span className="sr-only">{t('loading')}</span>}
    </div>
  );
}
export function Empty({
  icon: Icon = Package,
  title,
  text,
  children,
}: {
  icon?: typeof Package;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={30} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export function ProductArt({ product }: { product: Product }) {
  const icons: Record<string, typeof Package> = {
    banana: Banana,
    'energy-ranger': Flame,
    'cappuccino-hard': Coffee,
    cookies: Cookie,
    vanilla: Flower2,
    'cappuccino-softi': Coffee,
    'abu-bint': Wheat,
    'energy-new': Flame,
    orange: Leaf,
    apple: Apple,
    mango: Leaf,
  };
  const Icon = icons[product.id] || categoryIcons[product.category];
  const { t } = useApp();
  const [failedImage, setFailedImage] = useState('');
  return (
    <div className={'product-art ' + product.category + ' flavor-' + product.id}>
      {product.image_url && failedImage !== product.image_url ? (
        <img
          src={product.image_url}
          onError={() => setFailedImage(product.image_url!)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width="400"
          height="320"
        />
      ) : (
        <>
          <img
            className="product-brand-fallback"
            src="/brand/hamiya-food-icon-192.png"
            alt=""
            width={96}
            height={96}
          />
          <Icon size={28} strokeWidth={1.3} aria-hidden="true" />
          <span>{t(product.category + 'Brand')}</span>
        </>
      )}
    </div>
  );
}
export function CategoryCard({ category, index = 0 }: { category: Category; index?: number }) {
  const { t, navigate } = useApp();
  const Icon = categoryIcons[category];
  return (
    <button className={'category-card ' + category} onClick={() => navigate('catalog/' + category)}>
      <div className="category-card-top">
        <span className="category-number">0{index + 1}</span>
        <ArrowUpRight size={23} />
      </div>
      <div className="category-illustration">
        {category === 'food' ? <FoodBrandMark alt="" /> : <Icon strokeWidth={0.9} />}
        <span className="orb one" />
        <span className="orb two" />
      </div>
      <div className="category-card-bottom">
        <span className="eyebrow">{t(category)}</span>
        <h3>{t(category + 'Brand')}</h3>
        <p>{t(category + 'Desc')}</p>
      </div>
    </button>
  );
}
