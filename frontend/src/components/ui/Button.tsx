import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm"
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
      className={`rounded-md font-medium transition-all duration-150 ${variantClasses[variant]} ${sizeClasses[size]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
