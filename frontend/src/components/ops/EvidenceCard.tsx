import { format } from "date-fns";
import Badge from "../ui/Badge";

type Props = {
  evidence: any;
};

const EvidenceCard = ({ evidence }: Props) => {
  return (
    <article className="flex gap-4 rounded border border-slate-200 bg-white p-3 shadow-sm">
      <div className="w-28 h-20 bg-slate-100 flex items-center justify-center overflow-hidden rounded">
        {evidence.storage_path ? (
          <img src={evidence.storage_path} alt={evidence.file_name} className="h-full w-full object-cover" />
        ) : (
          <div className="text-sm text-slate-500">No preview</div>
        )}
      </div>
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-slate-900">{evidence.file_name}</h4>
        <p className="text-xs text-slate-500 mt-1">{evidence.content_type || evidence.file_type}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">{format(new Date(evidence.uploaded_at), "yyyy-MM-dd HH:mm:ss")}</div>
          <div className="flex items-center gap-2">
            {evidence.file_hash ? <Badge label={"HASHED"} /> : null}
            <Badge label={"EVIDENCE"} />
          </div>
        </div>
      </div>
    </article>
  );
};

export default EvidenceCard;
