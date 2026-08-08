import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

export default function AppShell({
  children,
  backendStatus,
}: {
  children: React.ReactNode;
  backendStatus?: boolean | null;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header backendStatus={backendStatus} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-24 pt-6 sm:px-8 sm:pt-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
