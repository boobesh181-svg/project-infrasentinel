import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
};

const Card = ({ title, subtitle, className = "", children, ...props }: CardProps) => {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 ${className}`}
      {...props}
    >
      {title ? <h3 className="text-[20px] font-semibold text-slate-900">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
};

export default Card;
