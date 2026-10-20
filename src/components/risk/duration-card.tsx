import { Panel } from "@/components/shared/panel";
import { Num } from "@/components/shared/num";
import { DURATION_BANDS } from "@/config/risk";
import { displayDuration, durationBandIndex, durationType } from "@/lib/portfolio/duration";
import type { DurationView } from "@/lib/portfolio/exposure";
import { cn } from "@/lib/utils";

const SHORT_NAMES = ["Ultra-Short", "Short", "Intermediate", "Long"];

const tickers = (list: { ticker: string }[]) => list.map((f) => f.ticker).join(", ");

/** Average duration of the bond holdings and which duration type that is, on a four-step scale. */
export function DurationCard({ view, notFound = [] }: { view: DurationView; /** Tickers Claude already looked up and found no duration for (tried again after a week). */ notFound?: string[] }) {
  const { average, withoutDuration, total } = view;
  const gaveUp = withoutDuration.filter((f) => notFound.includes(f.ticker));
  const waiting = withoutDuration.filter((f) => !notFound.includes(f.ticker));

  if (total === 0) {
    return (
      <Panel title="Fixed Income Duration" className="h-full">
        <p className="py-8 text-center text-muted-foreground">No fixed income holdings yet.</p>
      </Panel>
    );
  }

  const active = average === null ? -1 : durationBandIndex(average);
  return (
    <Panel title="Fixed Income Duration" className="h-full">
      <div className="py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm font-semibold tracking-tight">Average Duration</h3>
          <p className="ml-auto text-sm font-semibold tracking-tight">{average === null ? "Not available yet" : durationType(average)}</p>
        </div>

        <div>
          <div className="mt-4 flex items-baseline gap-2">
            <Num className="text-3xl font-semibold text-primary">{average === null ? "—" : displayDuration(average).toFixed(1)}</Num>
            <span className="text-muted-foreground">years</span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-1.5" role="img" aria-label={average === null ? "No duration yet" : `${durationType(average)}, ${displayDuration(average).toFixed(1)} years`}>
            {DURATION_BANDS.map((band, i) => (
              <div key={band.label} className="min-w-0">
                <div className={cn("h-3 rounded-[3px]", i === active ? "bg-primary" : "bg-muted")} />
                <p className={cn("mt-2 text-[10px] font-medium uppercase tracking-[0.02em] sm:text-[12px] sm:tracking-[0.06em]", i === active ? "text-foreground" : "text-muted-foreground")}>{SHORT_NAMES[i]}</p>
                <p className="text-[11px] text-muted-foreground">{band.range}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 text-[12px] text-muted-foreground">
          Duration measures how much a bond fund&rsquo;s price moves when interest rates change: the longer the duration, the more sensitive it is.
        </p>
        {(waiting.length > 0 || gaveUp.length > 0) && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {waiting.length > 0 && <>Looking up the duration of {tickers(waiting)}; check back shortly. </>}
            {gaveUp.length > 0 && <>No duration could be found for {tickers(gaveUp)}, so {gaveUp.length === 1 ? "it is" : "they are"} left out of the average; we will try again later.</>}
          </p>
        )}
      </div>
    </Panel>
  );
}
