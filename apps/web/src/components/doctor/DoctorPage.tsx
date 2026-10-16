import type { AeiClient, Alert } from "@aei/contract";
import type { WardCode } from "@aei/domain";
import type { Locale } from "@aei/i18n";

// The doctor's list (spec-doctor.md with spec-amendments.md). Stub until the builder lands.

export interface DoctorPageProps {
  client: AeiClient;
  locale: Locale;
  /** The replay clock's date; null while connecting. */
  asOf: string | null;
  /** Alerts of the last 28 days, newest first (live). */
  alerts: Alert[];
  /** Opens the researcher's board filtered to a unit. */
  onOpenSignals: (ward: WardCode) => void;
}

export function DoctorPage(_props: DoctorPageProps) {
  return <div className="section" />;
}
