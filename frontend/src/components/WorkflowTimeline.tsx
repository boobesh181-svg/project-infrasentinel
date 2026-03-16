import { MaterialStatus } from "../types/materialEntry";

const STEPS: MaterialStatus[] = ["DRAFT", "SUBMITTED", "VERIFIED", "APPROVED", "LOCKED"];

const WorkflowTimeline = ({ status }: { status: MaterialStatus }) => {
  return (
    <div className="rounded-xl border border-cloud bg-white/90 p-6 shadow-soft">
      <p className="text-sm font-semibold text-ink">Workflow Timeline</p>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {STEPS.map((step) => {
          const isActive = step === status;
          const isComplete = STEPS.indexOf(step) < STEPS.indexOf(status);
          return (
            <div key={step} className="rounded-lg border border-cloud p-3 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate">{step}</p>
              <div
                className={`mt-2 h-2 rounded-full ${
                  isActive ? "bg-accent" : isComplete ? "bg-navy" : "bg-cloud"
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowTimeline;
