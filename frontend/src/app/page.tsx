"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  API_BASE_URL,
  checkBackendHealth,
  getJobStatus,
  uploadVideo,
  type JobStage,
} from "@/lib/api";
import StageProgress from "@/components/StageProgress";

const POLL_INTERVAL_MS = 1500;

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "processing"; jobId: string; stage: JobStage }
  | { status: "error"; message: string };

export default function Home() {
  const router = useRouter();
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkBackendHealth().then(setBackendUp);
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">PreFlight</h1>
        <p className="max-w-md text-sm text-neutral-500">
          Upload a draft video. PreFlight predicts where viewers will lose
          interest before you publish.
        </p>
        <span
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            backendUp === null
              ? "bg-neutral-100 text-neutral-500"
              : backendUp
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              backendUp === null
                ? "bg-neutral-400"
                : backendUp
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
          />
          {backendUp === null
            ? "Checking backend..."
            : backendUp
              ? `Backend connected (${API_BASE_URL})`
              : `Backend unreachable (${API_BASE_URL})`}
        </span>
      </div>

      <label
        htmlFor="video-upload"
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={busy ? undefined : onDrop}
        aria-disabled={busy}
        className={`flex w-full max-w-lg flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          busy
            ? "cursor-not-allowed border-neutral-200 opacity-60"
            : "cursor-pointer border-neutral-300 hover:border-neutral-400"
        } ${dragActive && !busy ? "border-neutral-800 bg-neutral-50" : ""}`}
      >
        <span className="text-sm font-medium">
          Drag and drop a video file here, or click to browse
        </span>
        <span className="text-xs text-neutral-400">MP4, MOV, WebM...</span>
        <input
          id="video-upload"
          type="file"
          accept="video/*"
          className="hidden"
          disabled={busy}
          onChange={onFileInputChange}
        />
      </label>

      <div className="w-full max-w-lg">
        {upload.status === "uploading" && (
          <p className="text-center text-sm text-neutral-500">Uploading...</p>
        )}
        {upload.status === "processing" && (
          <div className="flex flex-col items-center gap-3">
            <StageProgress currentStage={upload.stage} />
            <p className="text-xs text-neutral-400">job {upload.jobId}</p>
          </div>
        )}
        {upload.status === "error" && (
          <p className="text-center text-sm text-red-600">
            {upload.message}
          </p>
        )}
      </div>
    </div>
  );
}
