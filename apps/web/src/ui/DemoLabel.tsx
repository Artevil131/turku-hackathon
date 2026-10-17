import { type Locale, t } from "../i18n/index.ts";

export function DemoLabel({ locale }: { locale: Locale }) {
  return <p className="app-demo-label">{t(locale, "common.demo")}</p>;
}
