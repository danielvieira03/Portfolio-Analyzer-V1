"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeHoldingFromPortfolio } from "@/lib/storage/browser";
import type { Position } from "@/lib/portfolio/types";

export function RemoveHoldingDialog({
  position,
  onClose,
}: {
  position: Position | null;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={!!position} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {position?.ticker}?</AlertDialogTitle>
          <AlertDialogDescription>
            {position?.name} will be deleted from your holdings. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              if (position) removeHoldingFromPortfolio(position.id);
              onClose();
            }}
          >
            Remove
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
