import { APP_NAME } from "@/config/nav";
import { NavLinks } from "./nav-links";

/** App name on the left, navigation tabs beside it. */
export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-11 items-stretch gap-4 border-b bg-sidebar px-3 md:gap-8 md:px-5">
      <div className="flex shrink-0 items-center gap-2">
        <span className="size-2 rounded-[2px] bg-primary" aria-hidden />
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
          {APP_NAME}
        </span>
      </div>
      <NavLinks />
    </header>
  );
}
