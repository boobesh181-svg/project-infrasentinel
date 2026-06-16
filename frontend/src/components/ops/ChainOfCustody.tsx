import React from 'react';
import { Clock, CheckCircle, Link as LinkIcon, Eye } from 'lucide-react';

type Props = {
  coc: any;
};

const statusLabel = (flag: boolean | undefined) => (flag ? 'yes' : 'no');

const ChainOfCustody = ({ coc }: Props) => {
  if (!coc) return <div className="text-sm text-slate-400">No chain-of-custody data.</div>;
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase text-slate-400">Chain of custody</div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-slate-900/30 px-3 py-1 text-[12px] text-slate-200">
          <CheckCircle className="h-4 w-4 text-emerald-300" />
          <div className="text-left">
            <div className="text-[11px]">Captured</div>
            <div className="text-[12px] font-semibold">{statusLabel(coc.captured)}{coc.captured_at ? ` · ${new Date(coc.captured_at).toLocaleString()}` : ''}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-slate-900/30 px-3 py-1 text-[12px] text-slate-200">
          <CheckCircle className="h-4 w-4 text-emerald-300" />
          <div className="text-left">
            <div className="text-[11px]">Verified</div>
            <div className="text-[12px] font-semibold">{statusLabel(coc.verified)}{coc.verified_at ? ` · ${new Date(coc.verified_at).toLocaleString()}` : ''}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-slate-900/30 px-3 py-1 text-[12px] text-slate-200">
          <LinkIcon className="h-4 w-4 text-cyan-300" />
          <div className="text-left">
            <div className="text-[11px]">Linked</div>
            <div className="text-[12px] font-semibold">{statusLabel(coc.linked)}{coc.linked_at ? ` · ${new Date(coc.linked_at).toLocaleString()}` : ''}</div>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-slate-900/30 px-3 py-1 text-[12px] text-slate-200">
          <Eye className="h-4 w-4 text-amber-300" />
          <div className="text-left">
            <div className="text-[11px]">Reviewed</div>
            <div className="text-[12px] font-semibold">{statusLabel(coc.reviewed)}{coc.reviewed_at ? ` · ${new Date(coc.reviewed_at).toLocaleString()}` : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChainOfCustody;
