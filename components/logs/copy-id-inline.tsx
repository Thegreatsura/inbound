"use client"

import { useState } from "react";
import Copy2 from "@/components/icons/copy-2";
import Check2 from "@/components/icons/check-2";

interface CopyIdInlineProps {
  id: string;
}

export function CopyIdInline({ id }: CopyIdInlineProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 font-mono hover:text-foreground transition-colors"
      title={copied ? "Copied!" : "Copy ID"}
    >
      {copied ? (
        <Check2 width="10" height="10" className="text-green-600" />
      ) : (
        <Copy2 width="10" height="10" />
      )}
      {id}
    </button>
  );
}

