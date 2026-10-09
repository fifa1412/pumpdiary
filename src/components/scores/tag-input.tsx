"use client";

import { X } from "lucide-react";
import { useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { cleanTag, MAX_TAGS_LENGTH, tagsLength } from "@/lib/youtube/upload";
import { cn } from "@/lib/utils";

// Chip-style tag editor in the spirit of YouTube Studio: Enter or a comma
// adds the typed tag, Backspace in an empty box removes the last one.
export function TagInput({
  id,
  tags,
  onChange,
  disabled,
  placeholder,
  removeLabel,
  describedBy,
}: {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder: string;
  removeLabel: (tag: string) => string;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const length = tagsLength(tags);

  function add(values: string[]) {
    const next = [...tags];
    for (const value of values) {
      const tag = cleanTag(value);
      if (!tag || next.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
      if (tagsLength([...next, tag]) > MAX_TAGS_LENGTH) break;
      next.push(tag);
    }
    if (next.length !== tags.length) onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    add([draft]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!text.includes(",")) return;
    event.preventDefault();
    add(`${draft}${text}`.split(","));
    setDraft("");
  }

  return (
    <div className="space-y-1">
      <div className={cn(
        "flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-input bg-surface-deep p-2 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        disabled && "cursor-not-allowed opacity-50",
      )}>
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-secondary py-1 pl-2.5 pr-1 text-sm text-secondary-foreground">
            {tag}
            <button type="button" disabled={disabled} onClick={() => onChange(tags.filter((existing) => existing !== tag))}
              aria-label={removeLabel(tag)}
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-background/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        ))}
        <input id={id} value={draft} disabled={disabled} placeholder={placeholder} autoComplete="off"
          onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} onBlur={commitDraft}
          aria-describedby={describedBy}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm" />
      </div>
      <p className="text-right font-numeric text-xs text-muted-foreground tabular-nums">{length}/{MAX_TAGS_LENGTH}</p>
    </div>
  );
}
