import EvidenceCard from "./EvidenceCard";

type Props = {
  events: any[];
};

const Timeline = ({ events }: Props) => {
  return (
    <div className="space-y-4">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4">
          <div className="w-2 flex-shrink-0">
            <div className="h-full w-0.5 bg-slate-200" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">{ev.vehicle_plate || "Vehicle"}</h3>
              <div className="text-xs text-slate-500">{new Date(ev.occurred_at).toLocaleString()}</div>
            </div>
            <div className="mt-2">
              {ev.evidence && ev.evidence.length ? (
                ev.evidence.map((e: any) => <EvidenceCard key={e.id} evidence={e} />)
              ) : (
                <div className="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-500">No evidence</div>
              )}
          
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;
