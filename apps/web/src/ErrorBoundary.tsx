import { type Locale, t } from "@aei/i18n";
import { Component, type ReactNode } from "react";

const locale = (): Locale => (document.documentElement.lang === "fi" ? "fi" : "en");

/**
 * The last line of defence: a render error, or a page chunk that no longer exists after a deploy, shows one calm
 * sentence and a Reload button instead of unmounting the whole app into a white screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("agar: the page failed to render", error);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-crash" role="alert">
        <p>{t(locale(), "appCrash")}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          {t(locale(), "appReload")}
        </button>
      </main>
    );
  }
}
