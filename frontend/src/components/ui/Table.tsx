import { ReactNode } from "react";

type TableProps = {
  headers: string[];
  children: ReactNode;
};

export const Table = ({ headers, children }: TableProps) => {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="max-h-[540px] overflow-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[14px] font-medium text-slate-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="border-b border-slate-200 px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-700">{children}</tbody>
        </table>
      </div>
    </div>
  );
};

export const TableRow = ({ children }: { children: ReactNode }) => (
  <tr className="odd:bg-white even:bg-slate-50/40 hover:bg-blue-50/60 transition-all duration-150">{children}</tr>
);

export const TableCell = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <td className={`border-b border-slate-100 px-4 py-3 align-middle ${className}`}>{children}</td>
);
