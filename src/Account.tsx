import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  LocateFixed,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  Upload,
  UserRound,
} from 'lucide-react';
import {
  authenticate,
  configured,
  currentProfile,
  openDocument,
  rpc,
  supabase,
  uploadDocument,
} from './api';
import { Badge, Empty, Field } from './components';
import { languages } from './i18n';
import { useApp } from './state';
import type { DocumentRecord, Profile } from './types';

export default function Account() {
  const {
    user,
    t,
    language,
    setLanguage,
    setUser,
    refreshUser,
    notifyError,
    toast,
    navigate,
    online,
    recovery,
    setRecovery,
  } = useApp();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('register');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [form, setForm] = useState<Profile>({});
  const [nationalId, setNationalId] = useState('');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState('');
  const [inlineError, setInlineError] = useState('');
  const profileId = user?.id;
  useEffect(() => {
    if (!profileId) return;
    let active = true;
    currentProfile()
      .then((data) => {
        if (active && data.user) {
          setForm(data.user.profile);
          setDocuments(data.documents);
        }
      })
      .catch(notifyError);
    return () => {
      active = false;
    };
  }, [profileId, notifyError]);
  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setInlineError('');
    const data = new FormData(event.currentTarget);
    try {
      if (mode === 'forgot') {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(String(data.get('email')), {
          redirectTo: window.location.origin + '/#account',
        });
        if (error) throw error;
        toast(t('resetSent'));
        setMode('login');
        return;
      }
      const result = await authenticate(mode, {
        email: String(data.get('email')),
        password: String(data.get('password')),
        full_name: String(data.get('full_name') || ''),
        language,
      });
      setUser(result.user);
      if (result.confirmation) setConfirmation(true);
      else {
        setEditing(mode === 'register');
        toast(t('welcomeBack'));
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    try {
      const password = String(new FormData(event.currentTarget).get('password'));
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setRecovery(false);
      toast(t('passwordReset'));
      await refreshUser();
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  async function save(next?: number) {
    setBusy(true);
    try {
      await rpc('profile_save', { ...form, ...(nationalId ? { national_id: nationalId } : {}) });
      setNationalId('');
      await refreshUser();
      toast(t('saved'));
      if (next !== undefined) setStep(next);
      return true;
    } catch (error) {
      notifyError(error);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function submitProfile() {
    if (!(await save())) return;
    setBusy(true);
    try {
      await rpc('profile_submit');
      await refreshUser();
      setEditing(false);
      toast(t('submitted'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined, kind: string) {
    if (!file) return;
    setUploading(kind);
    try {
      await uploadDocument(file, kind);
      const data = await currentProfile();
      setDocuments(data.documents);
      setUser(data.user);
      toast(t('uploaded'));
    } catch (error) {
      notifyError(error);
    } finally {
      setUploading('');
    }
  }
  async function resend() {
    if (!supabase || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: window.location.origin + '/#account' },
      });
      if (error) throw error;
      toast(t('emailSent'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      toast(t('locationDenied'));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((p) => ({
          ...p,
          location: { lat: position.coords.latitude, lng: position.coords.longitude },
        }));
        setBusy(false);
        toast(t('locationSaved'));
      },
      () => {
        setBusy(false);
        toast(t('locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }
  function input(key: keyof Profile, label: string, required = false) {
    return (
      <Field
        label={t(label)}
        required={required}
        value={String(form[key] || '')}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        autoComplete={
          key === 'full_name'
            ? 'name'
            : key === 'phone'
              ? 'tel'
              : key === 'address'
                ? 'street-address'
                : 'off'
        }
        type={key === 'phone' ? 'tel' : 'text'}
      />
    );
  }
  if (recovery)
    return (
      <section className="account-auth">
        <div className="form-panel">
          <span className="round-icon">
            <LockKeyhole />
          </span>
          <h1>{t('resetPassword')}</h1>
          <form onSubmit={reset}>
            <Field
              label={t('password')}
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
              hint={t('passwordHint')}
            />
            <button className="button primary" disabled={busy || !online}>
              {t('save')}
            </button>
          </form>
        </div>
      </section>
    );
  if (!user)
    return (
      <section className="account-auth">
        <div className="auth-story">
          <span className="eyebrow">HAMIYA INVESTMENT GROUP</span>
          <h1>{t('businessHome')}</h1>
          <p>{t('accountIntro')}</p>
          <div className="auth-graphic">
            <ShieldCheck size={140} strokeWidth={0.7} />
            <div className="auth-graphic-label">
              <LockKeyhole size={16} />
              {t('privateDocs')}
            </div>
          </div>
          <div className="language-pills">
            {languages.map((l) => (
              <button
                key={l.code}
                className={language === l.code ? 'active' : ''}
                onClick={() => setLanguage(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-panel">
          <span className="round-icon">
            <UserRound />
          </span>
          <h2>
            {t(
              mode === 'register'
                ? 'createAccount'
                : mode === 'forgot'
                  ? 'resetPassword'
                  : 'welcomeBack',
            )}
          </h2>
          <p>{t('accountGate')}</p>
          {confirmation && (
            <div className="notice good" role="status">
              <Mail size={20} />
              {t('emailSent')}
            </div>
          )}
          {!configured && <div className="notice">{t('servicePending')}</div>}
          <form onSubmit={submitAuth}>
            {mode === 'register' && (
              <Field
                label={t('fullName')}
                name="full_name"
                autoComplete="name"
                required
                maxLength={120}
              />
            )}
            <Field
              label={t('email')}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            {mode !== 'forgot' && (
              <Field
                label={t('password')}
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'register' ? 12 : 1}
                maxLength={128}
                hint={mode === 'register' ? t('passwordHint') : undefined}
              />
            )}
            <p className="field-error" role="alert">
              {inlineError}
            </p>
            <button className="button primary full" disabled={busy || !online || !configured}>
              {busy
                ? t('loading')
                : t(
                    mode === 'register'
                      ? 'createAccount'
                      : mode === 'forgot'
                        ? 'resetPassword'
                        : 'signIn',
                  )}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === 'login' && (
            <button className="text-button" onClick={() => setMode('forgot')}>
              {t('forgot')}
            </button>
          )}
          <p className="auth-switch">
            {t(mode === 'register' ? 'haveAccount' : 'newAccount')}{' '}
            <button
              onClick={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setConfirmation(false);
              }}
            >
              {t(mode === 'register' ? 'signIn' : 'register')}
            </button>
          </p>
          <div className="auth-legal">
            <button onClick={() => navigate('privacy')}>{t('privacy')}</button>
            <span>·</span>
            <button onClick={() => navigate('terms')}>{t('terms')}</button>
          </div>
        </div>
      </section>
    );
  const steps = ['business', 'location', 'documents', 'review'];
  return (
    <section className="account-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t('account')}</span>
          <h1>
            {t('welcomeBack')}, <em>{user.profile.full_name?.split(' ')[0]}</em>
          </h1>
          <p>{t('accountIntro')}</p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await supabase?.auth.signOut();
              setUser(null);
              setEditing(false);
            } catch (error) {
              notifyError(error);
            }
          }}
        >
          <LogOut size={16} />
          {t('signOut')}
        </button>
      </div>
      <div className="account-grid">
        <aside className="account-summary">
          <div className="avatar">{user.profile.full_name?.slice(0, 1) || 'H'}</div>
          <h3>{user.profile.business_name || user.profile.full_name}</h3>
          <p>{user.email}</p>
          <div className="customer-code">
            <span>{t('customerId')}</span>
            <b>{user.customer_id}</b>
          </div>
          <Badge status={user.verification} />
          {user.review_reason && (
            <div className="notice">
              <div>
                <strong>{t('reviewReason')}</strong>
                <p>{user.review_reason}</p>
              </div>
            </div>
          )}
          {!user.email_verified && (
            <div className="email-notice">
              <Mail size={20} />
              <p>{t('verifyEmail')}</p>
              <button className="text-button" disabled={busy || !online} onClick={resend}>
                {t('resend')}
              </button>
            </div>
          )}
          <button
            className="summary-link"
            onClick={() => {
              setEditing(true);
              setStep(0);
            }}
          >
            <UserRound size={18} />
            {t('profile')}
            <ChevronRight size={15} />
          </button>
          <button className="summary-link" onClick={() => navigate('orders')}>
            <FileCheck2 size={18} />
            {t('orders')}
            <ChevronRight size={15} />
          </button>
          <button className="summary-link" onClick={() => navigate('privacy')}>
            <ShieldCheck size={18} />
            {t('privacy')}
            <ChevronRight size={15} />
          </button>
        </aside>
        <div className="account-content">
          {editing || user.verification === 'draft' ? (
            <div className="panel profile-editor">
              <div className="section-heading">
                <div>
                  <h2>{t('finishProfile')}</h2>
                  <p>{t('reviewHint')}</p>
                </div>
              </div>
              <ol className="steps" aria-label={t('profileSteps')}>
                {steps.map((label, index) => (
                  <li
                    key={label}
                    className={step === index ? 'active' : step > index ? 'done' : ''}
                  >
                    <button onClick={() => setStep(index)}>
                      <span>{step > index ? <Check size={14} /> : index + 1}</span>
                      {t(label)}
                    </button>
                  </li>
                ))}
              </ol>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step < 3) void save(step + 1);
                  else void submitProfile();
                }}
              >
                {step === 0 && (
                  <div className="form-grid">
                    {input('full_name', 'fullName', true)}
                    {input('business_name', 'businessName', true)}
                    {input('phone', 'phone', true)}
                    <label className="field">
                      <span>{t('businessType')}</span>
                      <select
                        value={form.business_type || ''}
                        onChange={(e) => setForm((p) => ({ ...p, business_type: e.target.value }))}
                      >
                        <option value="">{t('select')}</option>
                        {['retailer', 'wholesaler', 'other'].map((value) => (
                          <option key={value} value={value}>
                            {t(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {input('trade_license', 'tradeLicense', true)}
                    <Field
                      label={t('nationalId')}
                      value={nationalId}
                      placeholder={user.national_mask}
                      onChange={(e) => setNationalId(e.target.value)}
                      minLength={6}
                      maxLength={100}
                      autoComplete="off"
                      required={!user.national_mask}
                    />
                  </div>
                )}
                {step === 1 && (
                  <>
                    <div className="form-grid">
                      {input('region', 'region', true)}
                      {input('city', 'city', true)}
                      {input('subcity', 'subcity')}
                      {input('woreda', 'woreda')}
                      {input('kebele', 'kebele')}
                      {input('landmark', 'landmark', true)}
                      <div className="full-span">{input('address', 'address', true)}</div>
                      <div className="full-span">{input('delivery_notes', 'deliveryNotes')}</div>
                    </div>
                    <div className="location-box">
                      <MapPin size={25} />
                      <div>
                        <strong>{t(form.location ? 'locationSaved' : 'location')}</strong>
                        <p>{t('locationHint')}</p>
                      </div>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={locate}
                      >
                        <LocateFixed size={16} />
                        {t('useLocation')}
                      </button>
                    </div>
                    {form.location && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setForm((p) => ({ ...p, location: null }))}
                      >
                        {t('removeLocation')}
                      </button>
                    )}
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="notice">
                      <ShieldCheck size={20} />
                      {t('privateDocs')}
                    </div>
                    <p className="muted">{t('uploadHint')}</p>
                    <div className="upload-grid">
                      {[
                        ['profile_photo', 'profilePhoto'],
                        ['national_id', 'nationalDocument'],
                        ['trade_license', 'licenseDocument'],
                      ].map(([kind, label]) => {
                        const uploaded = documents.some((d) => d.kind === kind);
                        return (
                          <div className={'upload-card ' + (uploaded ? 'uploaded' : '')} key={kind}>
                            {uploaded ? <CheckCircle2 size={30} /> : <Upload size={30} />}
                            <h3>{t(label)} *</h3>
                            <span>{t(uploaded ? 'uploaded' : 'required')}</span>
                            <label className="button secondary">
                              {uploading === kind ? t('loading') : t('upload')}
                              <input
                                className="visually-hidden"
                                type="file"
                                accept={
                                  kind === 'profile_photo'
                                    ? 'image/png,image/jpeg'
                                    : 'image/png,image/jpeg,application/pdf'
                                }
                                disabled={!!uploading || !online}
                                onChange={(e) => {
                                  void upload(e.target.files?.[0], kind);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {uploaded && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => void openDocument(user.id, kind).catch(notifyError)}
                              >
                                {t('details')}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {step === 3 && (
                  <>
                    <div className="review-box">
                      <h3>{form.business_name}</h3>
                      <p>
                        {form.full_name} · {form.phone}
                      </p>
                      <p>
                        {form.address}, {form.city}
                      </p>
                      <div className="document-checks">
                        {[
                          ['profile_photo', 'profilePhoto'],
                          ['national_id', 'nationalDocument'],
                          ['trade_license', 'licenseDocument'],
                        ].map(([kind, label]) => (
                          <span key={kind}>
                            {documents.some((d) => d.kind === kind) ? (
                              <CheckCircle2 size={17} />
                            ) : (
                              <Upload size={17} />
                            )}{' '}
                            {t(label)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={!!form.consent}
                        onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))}
                        required
                      />
                      {t('consent')}
                    </label>
                    <div className="inline-links">
                      <button type="button" onClick={() => navigate('privacy')}>
                        {t('privacy')}
                      </button>
                      <button type="button" onClick={() => navigate('terms')}>
                        {t('terms')}
                      </button>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={!!form.marketing}
                        onChange={(e) => setForm((p) => ({ ...p, marketing: e.target.checked }))}
                      />
                      {t('marketing')}
                    </label>
                  </>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || !online}
                    onClick={() => void save()}
                  >
                    {t('saveDraft')}
                  </button>
                  <div>
                    {step > 0 && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setStep(step - 1)}
                      >
                        {t('back')}
                      </button>
                    )}
                    <button className="button primary" disabled={busy || !!uploading || !online}>
                      {busy ? t('loading') : t(step === 3 ? 'submitReview' : 'continue')}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="panel profile-status">
                <ShieldCheck size={44} />
                <h2>
                  {t(user.verification === 'approved' ? 'profileComplete' : user.verification)}
                </h2>
                <p>{t('reviewHint')}</p>
                <button className="button secondary" onClick={() => setEditing(true)}>
                  {t('editProfile')}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="panel">
                <h2>{t('profile')}</h2>
                <dl className="details-list">
                  {[
                    ['businessName', user.profile.business_name],
                    ['fullName', user.profile.full_name],
                    ['phone', user.profile.phone],
                    ['address', user.profile.address],
                    ['city', user.profile.city],
                    ['nationalId', user.national_mask],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{t(label || '')}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
          <div className="panel">
            <h2>{t('language')}</h2>
            <div className="language-pills">
              {languages.map((l) => (
                <button
                  key={l.code}
                  className={language === l.code ? 'active' : ''}
                  onClick={() => setLanguage(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel">
            <h2>{t('security')}</h2>
            <p>{t('deleteText')}</p>
            <button
              className="text-button danger"
              disabled={!!user.deletion_requested_at || !online}
              onClick={async () => {
                try {
                  await rpc('deletion_request');
                  await refreshUser();
                  toast(t('deletionRequested'));
                } catch (error) {
                  notifyError(error);
                }
              }}
            >
              {t(user.deletion_requested_at ? 'deletionRequested' : 'deleteRequest')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AccountGate() {
  const { t, navigate } = useApp();
  return (
    <Empty icon={UserRound} title={t('signIn')} text={t('accountGate')}>
      <button className="button primary" onClick={() => navigate('account')}>
        {t('signIn')}
        <ArrowRight size={16} />
      </button>
    </Empty>
  );
}
