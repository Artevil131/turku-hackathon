import type { ReactNode } from "react";

// Light Markdown for notes: # headings (three levels), **bold**, *italic*, `inline code`, - or 1. lists,
// paragraphs. React elements only (no HTML is injected), so a note can hold any text safely.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = at + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "h"; level: 1 | 2 | 3; text: string } | { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

export function parseNote(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (h) {
      flush();
      blocks.push({ kind: "h", level: (h[1] as string).length as 1 | 2 | 3, text: h[2] as string });
    } else if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      const item = ((ul ?? ol) as RegExpExecArray)[1] as string;
      if (prev && prev.kind === kind) prev.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else para.push(line.trim());
  }
  flush();
  return blocks;
}

export function NoteView({ text }: { text: string }) {
  return (
    <>
      {parseNote(text).map((b, i) => {
        const k = `b${i}`;
        if (b.kind === "h") {
          // Inside a cell whose own heading is h3, the note's levels start below it.
          const Tag = (["h4", "h5", "h6"] as const)[b.level - 1] ?? "h6";
          return <Tag key={k}>{inline(b.text, k)}</Tag>;
        }
        if (b.kind === "p") return <p key={k}>{inline(b.text, k)}</p>;
        const List = b.kind;
        return (
          <List key={k}>
            {b.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond their place.
              <li key={j}>{inline(item, `${k}-${j}`)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
