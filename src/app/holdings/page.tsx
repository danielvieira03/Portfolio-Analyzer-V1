import { HoldingsView } from "@/components/views/holdings-view";

// The portfolio is read from the visitor's own browser, so this page is just a shell around the view.
// `?import=1` (from "Upload your own" on the home page) opens the Import dialog straight away.
export default async function HoldingsPage({ searchParams }: { searchParams: Promise<{ import?: string }> }) {
  const { import: openImport } = await searchParams;
  return <HoldingsView openImport={openImport === "1"} />;
}
