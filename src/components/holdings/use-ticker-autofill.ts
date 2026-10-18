"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { lookupProfileAction } from "@/app/holdings/actions";
import { libraryFunds } from "@/lib/portfolio/ledger";
import { getBrowserStore } from "@/lib/storage/browser";
import { lookupTicker } from "@/lib/storage/ticker-lookup";

interface AutofillFields {
  ticker: string;
  name: string;
  price: string;
  sector: string;
  subtype: string;
  /** Hidden: set from market data, never typed. */
  country: string;
}

export type LookupState = "idle" | "looking" | "found" | "none";

type Key = "name" | "price" | "sector" | "subtype";

/** How long the ticker field must sit still before the lookup runs, so a lookup isn't made for every keystroke. */
const TYPING_PAUSE_MS = 700;
const LOOKS_LIKE_TICKER = /^[A-Z0-9.^=\-]{1,12}$/;

/**
 * Fills name, price, (for stocks) sector and (for funds) maturity / type as soon as a ticker has been typed
 * and the typing pauses, or when the field is left. Only blank fields, or ones this hook filled earlier,
 * are filled: typed values are never overwritten. If the ticker is then changed to something with no data,
 * what this hook filled for the old ticker is cleared again.
 * `noSector` is the form's value for "nothing chosen" (used for both sector and maturity/type).
 */
export function useTickerAutofill<F extends AutofillFields>(
  form: F,
  setForm: Dispatch<SetStateAction<F>>,
  assetClass: string,
  initialTicker: string,
  noSector: string,
) {
  const [state, setState] = useState<LookupState>("idle");
  const last = useRef(initialTicker.trim().toUpperCase());
  const filled = useRef<Partial<Record<Key, string>>>({});

  const run = async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (t === last.current) return;
    last.current = t;
    if (!t) {
      setState("idle");
      return;
    }
    if (!LOOKS_LIKE_TICKER.test(t)) {
      setState("idle");
      return;
    }
    setState("looking");
    let res;
    try {
      res = await lookupTicker(t, assetClass, {
        fetchProfile: lookupProfileAction,
        libraryFunds: (tickers) => libraryFunds(getBrowserStore().getSnapshot().doc, tickers),
      });
    } catch {
      res = { found: false as const };
    }
    if (last.current !== t) return; // the ticker changed while we were looking
    if (!res.found) {
      // Nothing for this ticker: take back what an earlier ticker filled in, unless it was edited since.
      setForm((f) => {
        const next = { ...f, country: "" }; // the country always follows the ticker
        const undo = (key: Key, empty: string) => {
          if (filled.current[key] !== undefined && f[key] === filled.current[key]) next[key] = empty as F[Key];
        };
        undo("name", "");
        undo("price", "");
        undo("sector", noSector);
        undo("subtype", noSector);
        return next;
      });
      filled.current = {};
      setState("none");
      return;
    }
    const price = res.price === undefined ? undefined : String(res.price);
    setForm((f) => {
      const blank = (cur: string, key: Key, none = "") => cur.trim() === none || cur === filled.current[key];
      // The hidden country always follows the ticker: the new one, or none (ETFs, bonds, unknown tickers).
      const next = { ...f, country: res.country ?? "" };
      if (res.name && blank(f.name, "name")) next.name = filled.current.name = res.name;
      if (price !== undefined && blank(f.price, "price")) next.price = filled.current.price = price;
      if (res.sector && blank(f.sector, "sector", noSector)) next.sector = filled.current.sector = res.sector;
      if (res.subtype && blank(f.subtype, "subtype", noSector)) next.subtype = filled.current.subtype = res.subtype;
      return next;
    });
    setState("found");
  };

  // Run the lookup once the typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => void run(form.ticker), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a changed ticker should restart the timer
  }, [form.ticker]);

  return { state, onBlur: () => run(form.ticker) };
}
