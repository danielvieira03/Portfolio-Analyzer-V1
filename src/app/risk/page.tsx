import { RiskView } from "@/components/views/risk-view";

// The portfolio is read from the visitor's own browser, so this page is just a shell around the view.
export default function RiskPage() {
  return <RiskView />;
}
