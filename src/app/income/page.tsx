import { IncomeView } from "@/components/views/income-view";

// The portfolio is read from the visitor's own browser, so this page is just a shell around the view.
export default function IncomePage() {
  return <IncomeView />;
}
