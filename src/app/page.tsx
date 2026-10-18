import { DashboardView } from "@/components/views/dashboard-view";

// The portfolio is read from the visitor's own browser, so this page is just a shell around the view.
export default function DashboardPage() {
  return <DashboardView />;
}
