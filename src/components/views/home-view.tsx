"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, Upload } from "lucide-react";
import { usePortfolio } from "@/components/providers/use-portfolio";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { href: "/demos", icon: FlaskConical, title: "Choose a demo portfolio", text: "Explore three ready-made portfolios, each built to show something different." },
  { href: "/upload", icon: Upload, title: "Upload your own portfolio", text: "Bring in a CSV or Excel file, a screenshot or a PDF of your positions." },
];

export function HomeView() {
  const router = useRouter();
  const state = usePortfolio();

  const hasOwn = !!state && state.chosen && state.doc.holdings.length > 0;
  const ownIsDemo = !!state?.doc.isDemoData;

  return (
    // The top bar is one row shorter on this page, so pull the content up to match.
    <div className="-mt-9 space-y-8 pt-8">
      <section className="max-w-3xl">
        <p className="label-caps text-primary">Portfolio analytics</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">See what is really inside your portfolio.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Break a portfolio down by asset class, sector, country and risk, looking through ETFs and bond funds to what they actually hold.
          Explore a demo, or upload your own. Everything stays in your browser: no account, no login.
        </p>
        {hasOwn && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={() => router.push("/dashboard")}>
              Continue with {ownIsDemo ? "the demo" : "my portfolio"} <ArrowRight />
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {state!.doc.holdings.length} {state!.doc.holdings.length === 1 ? "holding" : "holdings"} saved in this browser
            </span>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {OPTIONS.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="panel group flex min-h-80 flex-col items-center justify-center gap-3 p-8 text-center transition-colors hover:border-primary/60 hover:bg-primary/5">
            <Icon className="size-10 text-primary" strokeWidth={1.5} />
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="max-w-md text-base text-muted-foreground">{text}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
              Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
