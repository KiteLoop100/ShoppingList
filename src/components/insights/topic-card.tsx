"use client";

interface TopicCardProps {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function TopicCard({ icon, title, description, selected, onClick }: TopicCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-aldi-blue bg-aldi-blue/5 ring-2 ring-aldi-blue"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <p className="font-semibold text-aldi-text">{title}</p>
          <p className="mt-0.5 text-sm text-aldi-muted">{description}</p>
        </div>
      </div>
    </button>
  );
}
