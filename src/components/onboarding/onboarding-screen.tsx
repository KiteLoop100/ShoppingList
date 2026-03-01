"use client";

interface OnboardingScreenProps {
  illustration: React.ReactNode;
  title: string;
  text: string;
  hint?: string;
}

export function OnboardingScreen({ illustration, title, text, hint }: OnboardingScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex w-full flex-1 items-center justify-center rounded-b-[2rem] bg-aldi-blue/[0.04] px-6 py-8">
        {illustration}
      </div>

      <div className="flex w-full shrink-0 flex-col items-center px-6 pb-4 pt-6">
        <h2 className="mb-3 text-center text-xl font-bold text-aldi-text">{title}</h2>
        <p className="max-w-[300px] text-center text-[15px] leading-relaxed text-aldi-muted">
          {text}
        </p>
        {hint && (
          <p className="mt-3 max-w-[280px] rounded-xl bg-aldi-orange/10 px-4 py-2.5 text-center text-[13px] leading-snug text-aldi-orange">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
