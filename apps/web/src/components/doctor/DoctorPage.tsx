import { CoverageWindow, type CoverageWindowProps } from "./CoverageWindow.tsx";

export type DoctorPageProps = Omit<CoverageWindowProps, "embedded">;

/** The legacy route shares the entire coverage flow with the workspace window. */
export function DoctorPage(props: DoctorPageProps) {
  return <CoverageWindow {...props} embedded={false} />;
}
