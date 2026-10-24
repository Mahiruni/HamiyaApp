import { useEffect, useId, useRef, type ReactNode, type InputHTMLAttributes } from 'react';
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
  Wheat,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from './state';
import type { Category, Product } from './types';
export const categoryIcons = { food: Wheat, coffee: Coffee, vehicles: CarFront };

export function HamiyaMark({
  size = 'md',
  label,
}: {
  size?: 'tiny' | 'sm' | 'md';
  label?: string;
}) {
  return (
    <span className={'hamiya-mark hamiya-mark-' + size} aria-hidden={label ? undefined : true}>
      <img src="/icon.svg" alt={label || ''} width={48} height={48} />
    </span>
  );
}

export function Money({ value }: { value: number | null | undefined }) {
  return (
    <span className="money">
      {new Intl.NumberFormat('en-ET', {
        minimumFractionDigits: 2,
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
  useEffect(() => {
    ref.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const { t } = useApp();
  return (
    <dialog
      ref={ref}
      className={'dialog ' + (wide ? 'wide' : '')}
      aria-labelledby={id}
      onCancel={onClose}
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
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {props.required && <b aria-label="required"> *</b>}
      </span>
      <input id={id} {...props} />
      {hint && <small>{hint}</small>}
    </label>
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
  return (
    <div className={'product-art ' + product.category + ' flavor-' + product.id}>
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} loading="lazy" width="400" height="320" />
      ) : (
        <>
          <Icon size={64} strokeWidth={1.05} />
          <span>{t('noPhoto')}</span>
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
        <Icon strokeWidth={0.9} />
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
