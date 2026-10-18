"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { lookupTickerAction } from "@/app/holdings/actions";

interface AutofillFields {
  ticker: string;
  name: string;
  price: string;
  sector: string;
  subtype: string;
}

export type LookupState = "idle" | "looking" | "found" | "none";

/**
 * Fills name, price and (for stocks) sector from market data when the ticker field is left.
 * Only blank fields, or ones this hook filled earlier, are filled: typed values are never overwritten.
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
  const last = useRef(initialTicker);
  const filled = useRef<{ name?: string; price?: string; sector?: string; subtype?: string }>({});

  const onBlur = async () => {
    const t = form.ticker.trim().toUpperCase();
    if (!t || t === last.current) return;
    last.current = t;
    setState("looking");
    let res;
    try {
      res = await lookupTickerAction(t, assetClass);
    } catch {
      res = { found: false as const };
    }
    if (last.current !== t) return; // the ticker changed while we were looking
    if (!res.found) {
      setState("none");
      return;
    }
    const price = res.price === undefined ? undefined : String(res.price);
    setForm((f) => {
      const blank = (cur: string, key: "name" | "price" | "sector" | "subtype", none = "") =>
        cur.trim() === none || cur === filled.current[key];
      const next = { ...f };
      if (res.name && blank(f.name, "name")) next.name = filled.current.name = res.name;
      if (price !== undefined && blank(f.price, "price")) next.price = filled.current.price = price;
      if (res.sector && blank(f.sector, "sector", noSector)) next.sector = filled.current.sector = res.sector;
      if (res.subtype && blank(f.subtype, "subtype", noSector)) next.subtype = filled.current.subtype = res.subtype;
      return next;
    });
    setState("found");
  };

  return { state, onBlur };
}
