import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-cyan-400/20 bg-cyan-500/12 text-cyan-50 hover:border-cyan-300/35 hover:bg-cyan-500/18 hover:text-white",
  secondary: "border border-white/10 bg-white/4 text-slate-100 hover:border-white/20 hover:bg-white/8",
  ghost: "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
  danger: "border border-rose-400/20 bg-rose-500/12 text-rose-50 hover:border-rose-300/35 hover:bg-rose-500/18 hover:text-white"
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
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-[0.04em] transition-colors duration-150 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
