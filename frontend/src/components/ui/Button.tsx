import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-cyan-400/25 bg-cyan-500/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_16px_32px_rgba(8,145,178,0.2)] hover:border-cyan-300/40 hover:bg-cyan-500/22 hover:text-white",
  secondary: "border border-white/10 bg-white/5 text-slate-100 shadow-[0_14px_28px_rgba(2,6,23,0.28)] hover:border-white/20 hover:bg-white/10",
  ghost: "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
  danger: "border border-rose-400/25 bg-rose-500/15 text-rose-50 shadow-[0_0_0_1px_rgba(251,113,133,0.12),0_16px_32px_rgba(190,18,60,0.2)] hover:border-rose-300/40 hover:bg-rose-500/22 hover:text-white"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm"
};

const Button = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: ButtonProps) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[0.04em] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
