import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
};

const Card = ({ title, subtitle, className = "", children, ...props }: CardProps) => {
  return (
    <section
      className={`operational-panel p-5 text-slate-100 ${className}`}
      {...props}
    >
      <div className="scanline" aria-hidden="true" />
      {title ? <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-white font-display">{title}</h3> : null}
      {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
};

export default Card;
