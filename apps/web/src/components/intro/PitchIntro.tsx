import type { AeiClient } from "@aei/contract";
import type { Locale } from "@aei/i18n";

// The pitch intro (#intro): a picture of pressure, not a working view. Stub until the builder lands.

export interface PitchIntroProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  /** Leaves the intro for the working tool. */
  onEnter: () => void;
  reducedMotion: boolean;
}

export function PitchIntro(_props: PitchIntroProps) {
  return <div className="intro" />;
}
