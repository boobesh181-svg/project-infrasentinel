import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  subtitle?: string;
};

const Card = ({ title, subtitle, className = "", children, ...props }: CardProps) => {
  return (
    <section
      className={`operational-panel p-4 text-slate-100 md:p-4.5 ${className}`}
      {...props}
    >
      <div className="scanline" aria-hidden="true" />
      {title ? <h3 className="font-display text-[17px] font-semibold tracking-[-0.03em] text-white md:text-[18px]">{title}</h3> : null}
      {subtitle ? <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-slate-400">{subtitle}</p> : null}
      <div className={title || subtitle ? "mt-3" : ""}>{children}</div>
    </section>
  );
};

export default Card;
