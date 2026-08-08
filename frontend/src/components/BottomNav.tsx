"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReportNavIcon, UploadNavIcon } from "@/components/icons";

export default function BottomNav() {
  const pathname = usePathname();
  const onReport = pathname?.startsWith("/report");
  const onUpload = pathname === "/";

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        <Link
          href={onReport ? pathname : "/report/demo"}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-5 py-1.5 text-xs font-medium transition-colors ${
            onReport ? "text-yt-red" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          }`}
        >
          <ReportNavIcon className="h-5 w-5" />
          Reports
        </Link>
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 rounded-lg px-5 py-1.5 text-xs font-medium transition-colors ${
            onUpload ? "text-yt-red" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          }`}
        >
          <UploadNavIcon className="h-5 w-5" />
          Upload
        </Link>
      </div>
    </nav>
  );
}
