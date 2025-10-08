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

export default function CiteDialog({ bib }: { bib: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(bib);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback if clipboard not available
      window.prompt("Copy BibLaTeX:", bib);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Cite</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>BibLaTeX citation</DialogTitle>
          <DialogDescription>
            Review and copy the BibLaTeX entry for this publication.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-neutral-50">
          <pre className="whitespace-pre-wrap p-3 text-sm overflow-auto font-mono">
{bib}
          </pre>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={onCopy}>
            {copied ? "Copied!" : "Copy to clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
