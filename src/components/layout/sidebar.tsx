import { NavLinks } from "./nav-links";

/** Fixed left navigation on desktop. On small screens the top bar opens it as a drawer. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-52 border-r bg-sidebar md:block">
      <div className="h-11 border-b" aria-hidden />
      <NavLinks />
    </aside>
  );
}
