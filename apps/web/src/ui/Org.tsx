/*
  Org: an organism name as the lab writes it, in italics (the convention for species names).
    name     string
    short?   boolean   "Genus species" -> "G. species" (derived from the name itself, never from a list)
  shortOrganism(name): the same abbreviation as plain text.
*/

export function shortOrganism(name: string): string {
  const parts = name.trim().split(/\s+/);
  const genus = parts[0];
  if (parts.length < 2 || !genus) return name;
  return `${genus.charAt(0).toUpperCase()}. ${parts.slice(1).join(" ")}`;
}

export function Org({ name, short = false }: { name: string; short?: boolean }) {
  return (
    <i className="k-org" title={short ? name : undefined}>
      {short ? shortOrganism(name) : name}
    </i>
  );
}
