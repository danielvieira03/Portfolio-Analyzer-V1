"use client";

import { useTransition } from "react";
import { removeHoldingAction } from "@/app/holdings/actions";
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
import type { Position } from "@/lib/portfolio/types";

export function RemoveHoldingDialog({
  position,
  onClose,
}: {
  position: Position | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
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
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (position) await removeHoldingAction(position.id);
                onClose();
              })
            }
          >
            {pending ? "Removing…" : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
