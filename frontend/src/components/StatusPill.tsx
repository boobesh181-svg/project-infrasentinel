type StatusPillProps = {
  label: string;
};

const StatusPill = ({ label }: StatusPillProps) => {
  return (
    <span className="rounded-full bg-cloud px-3 py-1 text-xs font-semibold text-ink">
      {label}
    </span>
  );
};

export default StatusPill;
