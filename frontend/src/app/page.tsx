"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkBackendHealth,
  getJobStatus,
  getReport,
  uploadVideo,
  type JobStage,
} from "@/lib/api";
import AppShell from "@/components/AppShell";
import ProcessingCard from "@/components/ProcessingCard";
import AnalysisBenefits from "@/components/AnalysisBenefits";
import { ChevronRightIcon, ReportNavIcon, UploadArrowIcon } from "@/components/icons";

const POLL_INTERVAL_MS = 1500;

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "processing"; jobId: string; stage: JobStage }
  | { status: "error"; message: string };

export default function Home() {
  const router = useRouter();
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [demoAvailable, setDemoAvailable] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
    // Only show the "sample report" card if the demo fixture actually
    // resolves — no dead link if backend/storage/demo/report.json is ever
    // missing.
    getReport("demo")
      .then(() => setDemoAvailable(true))
      .catch(() => setDemoAvailable(false));
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollStatus = useCallback(
    (jobId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          if (status.stage === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            router.push(`/report/${jobId}`);
          } else if (status.stage === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            setUpload({
              status: "error",
              message: status.error_message ?? "Processing failed",
            });
          } else {
            setUpload({ status: "processing", jobId, stage: status.stage });
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setUpload({
            status: "error",
            message: err instanceof Error ? err.message : "Status check failed",
          });
        }
      }, POLL_INTERVAL_MS);
    },
    [router],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setUpload({ status: "uploading" });
      try {
        const { job_id } = await uploadVideo(file);
        setUpload({ status: "processing", jobId: job_id, stage: "queued" });
        pollStatus(job_id);
      } catch (err) {
        setUpload({
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    },
    [pollStatus],
  );

  const cancelProcessing = useCallback(() => {
    // Stops polling and returns to idle. The backend job may still finish
    // processing server-side — this only stops the frontend from watching it.
    if (pollRef.current) clearInterval(pollRef.current);
    setUpload({ status: "idle" });
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const busy = upload.status === "uploading" || upload.status === "processing";

  return (
    <AppShell backendStatus={backendUp}>
      <div className="flex flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-neutral-900 px-6 py-8 text-white shadow-xl shadow-neutral-200 sm:px-9">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border-[18px] border-yt-red/80" />
          <div className="absolute -bottom-16 right-20 h-28 w-28 rounded-full bg-white/5" />
          <div className="relative max-w-2xl"><span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-neutral-200">Pre-publish video intelligence</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Find the moment viewers may leave.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-neutral-300">Upload your draft for a clear retention forecast, the riskiest moment, and a sharper opening before it goes live.</p></div>
          <div className="relative mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-neutral-300"><span><b className="text-white">01</b> Upload draft</span><span><b className="text-white">02</b> Analyze signals</span><span><b className="text-white">03</b> Improve before publish</span></div>
        </section>
        {upload.status === "processing" && (
          <ProcessingCard stage={upload.stage} onCancel={cancelProcessing} />
        )}

        {upload.status !== "processing" && (
          <label
            htmlFor="video-upload"
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={busy ? undefined : onDrop}
            aria-disabled={busy}
            className={`group relative flex min-h-[19rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center shadow-sm transition-all ${
              busy
                ? "cursor-not-allowed border-neutral-200 opacity-60"
                : "cursor-pointer border-neutral-300 hover:border-yt-red/40"
            } ${dragActive && !busy ? "border-yt-red bg-yt-red-light" : ""}`}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 transition-transform group-hover:-translate-y-1 group-hover:bg-yt-red-light group-hover:text-yt-red-dark">
              <UploadArrowIcon className="h-7 w-7" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold text-neutral-900">
                Drop in your latest cut
              </span>
              <span className="text-sm text-neutral-400">or click to browse</span>
            </div>
            <span className="rounded-full bg-yt-red px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-yt-red-dark">
              {upload.status === "uploading" ? "Uploading..." : "SELECT FILES"}
            </span>
            <span className="text-xs text-neutral-400">
              Video files up to 500 MB · Analysis runs locally
            </span>
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              className="hidden"
              disabled={busy}
              onChange={onFileInputChange}
            />
          </label>
        )}

        {upload.status === "error" && (
          <p className="text-center text-sm text-red-600">{upload.message}</p>
        )}

        {upload.status === "idle" && demoAvailable && (
          <Link
            href="/report/demo"
            className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 transition-colors hover:border-yt-red/30 hover:bg-neutral-50"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yt-red-light text-yt-red-dark">
                <ReportNavIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">See a sample report</p>
                <p className="text-xs text-neutral-400">
                  Explore a finished PreFlight analysis on a real video
                </p>
              </div>
            </div>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-neutral-300" />
          </Link>
        )}
        {upload.status === "idle" && <AnalysisBenefits />}
      </div>
    </AppShell>
  );
}
