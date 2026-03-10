interface SectionLabelProps {
  children: React.ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <dt className="text-xs font-medium uppercase tracking-wider text-aldi-muted">
      {children}
    </dt>
  );
}
