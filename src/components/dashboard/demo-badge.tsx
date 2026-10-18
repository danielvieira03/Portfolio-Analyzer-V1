"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearDemoPortfolio } from "@/lib/storage/browser";

/** "Demo data" marker with a button to clear the sample portfolio. */
export function DemoBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Badge variant="outline" className="h-6 border-primary/50 bg-primary/10 text-primary">
        Demo data
      </Badge>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Clear demo data
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the demo portfolio?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes all sample holdings and cash so you can start with your own. The demo
              will not come back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                clearDemoPortfolio();
                setOpen(false);
              }}
            >
              Clear demo data
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
