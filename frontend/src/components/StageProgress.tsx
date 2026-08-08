import { STAGE_STEPS, type JobStage } from "@/lib/api";
import { CheckIcon } from "@/components/icons";

export default function StageProgress({ currentStage }: { currentStage: JobStage }) {
  const currentIndex = STAGE_STEPS.findIndex((s) => s.stage === currentStage);

  return (
    <div className="flex flex-col">
      {STAGE_STEPS.map((step, i) => {
        const isDone = currentIndex > i || currentStage === "done";
        const isActive = i === currentIndex && currentStage !== "done";
        const isLast = i === STAGE_STEPS.length - 1;

        return (
          <div key={step.stage} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-yt-red text-white"
                    : isActive
                      ? "border-2 border-yt-red text-yt-red"
                      : "border-2 border-neutral-200 text-neutral-300"
                }`}
              >
                {isDone ? (
                  <CheckIcon className="h-4 w-4" />
                ) : isActive ? (
                  <span className="h-2 w-2 rounded-full bg-yt-red" />
                ) : (
                  i + 1
                )}
              </span>
              {!isLast && (
                <span className={`w-0.5 flex-1 ${isDone ? "bg-yt-red" : "bg-neutral-200"}`} />
              )}
            </div>
            <div className={`flex flex-col ${isLast ? "pb-0" : "pb-6"}`}>
              <span
                className={`text-base font-semibold ${
                  isActive || isDone ? "text-neutral-900" : "text-neutral-300"
                }`}
              >
                {step.label}
              </span>
              {isDone && <span className="text-sm text-neutral-400">Completed</span>}
              {isActive && (
                <>
                  <span className="text-sm font-medium text-yt-red">In progress...</span>
                  <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-yt-red" />
                  </div>
                </>
              )}
              {!isDone && !isActive && <span className="text-sm text-neutral-300">Pending</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
