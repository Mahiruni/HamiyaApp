import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function AuthField({
  label,
  icon: Icon,
  hint,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  hint?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="auth-field">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="auth-field-control">
        <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
        <input
          id={id}
          placeholder={label}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...props}
        />
        {children}
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

// Original vector artwork, using the same navy and blue-gray palette as the app.
export function AuthIllustration({ register = false }: { register?: boolean }) {
  return (
    <svg className="auth-illustration" viewBox="0 0 300 200" fill="none" aria-hidden="true">
      <ellipse cx="153" cy="99" rx="104" ry="81" fill="var(--surface)" />
      <path d="M43 185H263" stroke="#dbe4e9" strokeWidth="2" strokeLinecap="round" />
      <rect x="52" y="37" width="64" height="109" rx="2" fill="#f5f7f8" stroke="#dbe4e9" />
      {[49, 57, 65, 73, 81, 89, 97, 105, 113, 121, 129].map((y) => (
        <path key={y} d={`M59 ${y}H108`} stroke="#dbe4e9" />
      ))}
      <rect x="187" y="56" width="59" height="92" rx="2" fill="#e5ecf0" />
      <path
        d="M198 71H235M198 79H235M198 87H225M198 124H235M198 132H224"
        stroke="#c9d6dd"
        strokeWidth="2"
      />
      <rect x="104" y="18" width="91" height="161" rx="13" fill="#193b4d" />
      <rect x="109" y="23" width="81" height="151" rx="9" fill="white" />
      <path d="M130 22H170L167 29H133L130 22Z" fill="#193b4d" />
      {register ? (
        <>
          <circle cx="150" cy="58" r="14" fill="#edf2f5" />
          <circle cx="150" cy="54" r="4" fill="#7395a8" />
          <path d="M142 65C142 57 158 57 158 65" fill="#7395a8" />
          <rect x="121" y="83" width="57" height="12" rx="4" fill="#f0f4f6" />
          <rect x="121" y="102" width="57" height="12" rx="4" fill="#f0f4f6" />
          <rect x="121" y="121" width="57" height="12" rx="4" fill="#f0f4f6" />
          <path
            d="M128 89H162M128 108H165M128 127H156"
            stroke="#adc2cf"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M149 47L168 56V73C168 87 149 95 149 95C149 95 130 87 130 73V56L149 47Z"
            fill="#193b4d"
          />
          <path
            d="M140 71L147 78L159 64"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="121" y="110" width="57" height="14" rx="4" fill="#f0f4f6" />
          {[129, 137, 145, 153, 161, 169].map((x) => (
            <circle key={x} cx={x} cy="117" r="1.5" fill="#93adbd" />
          ))}
        </>
      )}
      <rect x="126" y="143" width="47" height="11" rx="5.5" fill="#193b4d" />
      <path d="M144 164H155" stroke="#dbe4e9" strokeWidth="3" strokeLinecap="round" />
      <g transform="rotate(12 205 36)">
        <rect x="192" y="29" width="29" height="26" rx="4" fill="#193b4d" />
        <path d="M199 29V23C199 12 214 12 214 23V29" stroke="#193b4d" strokeWidth="4" />
        <circle cx="207" cy="40" r="2.5" fill="white" />
        <path d="M207 42V46" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </g>
      <path d="M66 160C51 150 50 137 54 130C64 135 68 145 66 160Z" fill="#7395a8" />
      <path d="M67 157C78 144 80 130 76 122C67 130 64 143 67 157Z" fill="#193b4d" />
      <path d="M62 149C48 142 45 131 47 125C57 129 62 138 62 149Z" fill="#a3bdcc" />
      <path d="M66 164L64 142" stroke="#193b4d" strokeWidth="2" />
      <path d="M53 159H78L74 184H58L53 159Z" fill="#193b4d" />
      <path d="M213 128L208 181H217L224 143L227 181H236L232 126Z" fill="#193b4d" />
      <path
        d="M207 180H218V185H202C202 182 205 181 207 180ZM227 180H237L240 185H227V180Z"
        fill="#102b3a"
      />
      <path
        d="M215 87C209 88 206 95 207 105L211 135H234L236 102C235 92 229 87 222 87Z"
        fill="#52778c"
      />
      <path
        d="M211 100L200 114L184 107"
        stroke="#d6b49f"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M232 102L241 119L224 127"
        stroke="#d6b49f"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M211 96L203 108L210 112L220 98M229 96L238 109L230 114L223 99" fill="#52778c" />
      <path d="M215 80V91C220 95 225 92 226 88V78" fill="#d6b49f" />
      <ellipse cx="220" cy="74" rx="10" ry="13" fill="#e1c2ae" />
      <path
        d="M210 77C204 65 211 55 221 58C233 57 235 70 229 80L226 66L217 70L215 83L210 77Z"
        fill="#193b4d"
      />
      <path d="M184 107L181 104" stroke="#d6b49f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="82" cy="24" r="4" fill="#a3bdcc" />
      <circle cx="258" cy="152" r="3" fill="#a3bdcc" />
      <path d="M247 33V41M243 37H251" stroke="#a3bdcc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FoodBrandAuthIllustration() {
  return (
    <div className="auth-illustration food-auth-illustration" aria-hidden="true">
      <span className="food-auth-orbit" />
      <span className="food-auth-accent orange" />
      <span className="food-auth-accent green" />
      <span className="food-auth-accent black" />
      <span className="food-auth-logo">
        <img src="/brand/hamiya-food-icon-512.png" alt="" width={512} height={512} />
      </span>
    </div>
  );
}
