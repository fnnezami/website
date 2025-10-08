// /components/AbstractDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AbstractDialog({ abstract }: { abstract: string }) {
  const [open, setOpen] = useState(false);

  const text = abstract?.trim() || "No abstract available.";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Abstract</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abstract</DialogTitle>
          <DialogDescription>Read the paper abstract.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-neutral-50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {text}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
