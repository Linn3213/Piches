import clsx from "clsx";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Icon({
  name,
  className,
  filled,
  size = 20,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}) {
  return (
    // overflow-hidden + fast bredd/höjd: om ikontypsnittet inte hunnit ladda
    // (eller aldrig laddar, som i sandboxens nätverksspärr) faller webbläsaren
    // tillbaka till att rendera ikonnamnet som text — utan spärren här sprängs
    // den lilla cirkeln den ofta sitter i och texten kolliderar med rubriken bredvid.
    <span
      className={clsx(
        "material-symbols-outlined inline-block shrink-0 overflow-hidden align-middle leading-none",
        filled && "filled",
        className,
      )}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet" | "danger";
}) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-label-caps uppercase transition-all active:scale-95",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" && "bg-primary text-on-primary shadow-soft hover:bg-primary/90",
        variant === "ghost" &&
          "border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container",
        variant === "quiet" && "text-on-surface-variant hover:bg-surface-container",
        variant === "danger" &&
          "border border-error/30 bg-surface-container-lowest text-error hover:bg-error-container/40",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={clsx(
        "rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-label-caps uppercase text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="block text-xs text-on-surface-variant/70">{hint}</span>}
    </label>
  );
}

const control =
  "w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-3 text-body-md text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(control, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(control, "appearance-none pr-9", className)} {...props} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-4 py-3 transition-colors hover:bg-surface-container">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
      />
      <span className="text-body-md">{label}</span>
    </label>
  );
}

type Tone = "neutral" | "primary" | "warn" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-container-highest text-on-surface-variant",
  primary: "bg-primary-container text-on-primary-container",
  warn: "bg-sand/40 text-[#7a6434]",
  danger: "bg-error-container text-on-error-container",
  info: "bg-tertiary-container text-on-tertiary-container",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Card className="relative overflow-hidden">
      {tone && (
        <div
          className={clsx(
            "absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl",
            tone === "danger" ? "bg-error/10" : "bg-primary/10",
          )}
        />
      )}
      <div className="relative flex items-center gap-2 text-on-surface-variant">
        {icon && <Icon name={icon} size={18} />}
        <span className="text-label-caps uppercase">{label}</span>
      </div>
      <p
        className={clsx(
          "relative mt-3 font-mono text-3xl font-medium",
          tone === "danger" ? "text-error" : "text-on-surface",
        )}
      >
        {value}
      </p>
      {sub && <p className="relative mt-1 text-xs text-on-surface-variant">{sub}</p>}
    </Card>
  );
}

export function Empty({
  title,
  hint,
  icon = "inbox",
}: {
  title: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-outline-variant/50 px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={icon} size={26} />
      </div>
      <p className="text-headline-sm text-on-surface">{title}</p>
      {hint && <p className="mx-auto mt-2 max-w-xs text-body-md text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-on-background/30 sm:items-center sm:p-6">
      <div
        className={clsx(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-background p-6 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Stäng"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <h1 className="text-headline-lg text-on-background">{title}</h1>
        {subtitle && <p className="mt-2 text-body-md text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-body-md text-on-surface-variant">Laddar...</p>;
}
