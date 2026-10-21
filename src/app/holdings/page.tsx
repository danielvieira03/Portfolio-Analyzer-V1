import { HoldingsView } from "@/components/views/holdings-view";

// The portfolio is read from the visitor's own browser, so this page is just a shell around the view.
export default function HoldingsPage() {
  return <HoldingsView />;
}
