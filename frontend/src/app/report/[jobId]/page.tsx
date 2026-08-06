import ReportView from "@/components/ReportView";

export default async function ReportPage(props: PageProps<"/report/[jobId]">) {
  const { jobId } = await props.params;
  return <ReportView jobId={jobId} />;
}
