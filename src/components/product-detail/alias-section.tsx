import { SectionLabel } from "./section-label";

interface AliasSectionProps {
  aliases: string[] | null | undefined;
  label: string;
}

export function AliasSection({ aliases, label }: AliasSectionProps) {
  if (!aliases || aliases.length === 0) return null;

  return (
    <div className="mt-4 border-t border-aldi-muted-light pt-3">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {aliases.map((alias) => (
          <span
            key={alias}
            className="inline-block rounded-full bg-aldi-blue/10 px-2.5 py-0.5 text-xs font-medium text-aldi-blue"
          >
            {alias}
          </span>
        ))}
      </div>
    </div>
  );
}
