import { STAGE_STEPS, type JobStage } from "@/lib/api";

export default function StageProgress({ currentStage }: { currentStage: JobStage }) {
  const currentIndex = STAGE_STEPS.findIndex((s) => s.stage === currentStage);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      {STAGE_STEPS.map((step, i) => {
        const isDone = currentIndex > i || currentStage === "done";
        const isActive = i === currentIndex && currentStage !== "done";
        return (
          <div key={step.stage} className="flex items-center gap-3">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                isDone
                  ? "bg-neutral-900 text-white"
                  : isActive
                    ? "border-2 border-neutral-900 text-neutral-900"
                    : "border border-neutral-300 text-neutral-300"
              }`}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${
                isActive
                  ? "font-medium text-neutral-900"
                  : isDone
                    ? "text-neutral-500"
                    : "text-neutral-300"
              }`}
            >
              {step.label}
              {isActive && <span className="ml-1 animate-pulse">…</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
