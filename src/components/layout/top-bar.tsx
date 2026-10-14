"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { APP_NAME } from "@/config/nav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";

export function TopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-11 items-center gap-3 border-b bg-sidebar px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-[2px] bg-primary" aria-hidden />
        <span className="text-[13px] font-semibold uppercase tracking-[0.14em]">
          {APP_NAME}
        </span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-56 bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-11 border-b" aria-hidden />
          <NavLinks onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
