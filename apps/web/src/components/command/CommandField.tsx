import type { Alert } from "@aei/contract";
import { type Locale, type MessageKey, t } from "@aei/i18n";
import { type KeyboardEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import "./command.css";
import { buildEntries, type Group, type Result, search } from "./match.ts";

// The top bar's search and command field: a combobox over units, antibiotics,
// organisms, phenotypes, recent alerts and pages. Choosing a result sets the
// URL hash, which the app already follows. "/" and Ctrl/Cmd+K focus it.

const GROUP_LABEL: Record<Group, MessageKey> = {
  units: "cmdGroupUnits",
  antibiotics: "cmdGroupAntibiotics",
  organisms: "cmdGroupOrganisms",
  phenotypes: "cmdGroupPhenotypes",
  alerts: "cmdGroupAlerts",
  pages: "cmdGroupPages",
};

const SearchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/**
 * Goes to a hash. The doctor's list reads its URL only when it opens, so
 * choosing another unit while it is open leaves the page and comes back,
 * replacing the history entry rather than adding two.
 */
const RECENT_KEY = "aei.cmd.recent";
const RECENT_MAX = 3;

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    // storage may be blocked; recents are a convenience only
  }
}

function go(href: string): void {
  // Every page listens for hash changes, so this works from any page, the same one included.
  location.hash = href.slice(1);
}

interface Props {
  locale: Locale;
  /** The released alerts the app holds (the last four weeks); without them no alert is offered. */
  alerts?: readonly Alert[];
  /** The replay clock's as-of date; the 28 days of alerts end on it. */
  asOf?: string | null;
}

export function CommandField({ locale, alerts, asOf = null }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [ping, setPing] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => buildEntries(locale, alerts ?? [], asOf), [locale, alerts, asOf]);
  const [recent, setRecent] = useState<string[]>(readRecent);
  // With nothing typed, what the user chose last comes first, one click from the board.
  const results = useMemo(() => {
    const found = search(entries, query);
    if (query.trim()) return found;
    const mine = recent.flatMap((id) => entries.find((e) => e.id === id) ?? []).map((e) => ({ ...e, score: 1 }));
    return [...mine, ...found.filter((r) => !recent.includes(r.id))];
  }, [entries, query, recent]);
  const showList = focused;
  const current = results[Math.min(active, results.length - 1)];

  // "/" and Ctrl/Cmd+K, from anywhere. "/" is left alone while typing in a field.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const wantsK = k === "k" && (e.ctrlKey || e.metaKey) && !e.altKey;
      const wantsSlash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target);
      if (!wantsK && !wantsSlash) return;
      e.preventDefault();
      setExpanded(true);
      setPing((n) => n + 1);
    };
    // The sidebar's Search row asks for the palette by this event.
    const onAsk = () => {
      setExpanded(true);
      setPing((n) => n + 1);
    };
    addEventListener("keydown", onKey);
    addEventListener("aei:command", onAsk);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("aei:command", onAsk);
    };
  }, []);
  useEffect(() => {
    if (ping > 0) {
      input.current?.focus();
      input.current?.select();
    }
  }, [ping]);

  // Focus leaving the field, to anything outside it, closes the list (and the phone's expanded field).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onOut = (e: FocusEvent) => {
      if (el.contains(e.relatedTarget as Node | null)) return;
      setFocused(false);
      setExpanded(false);
    };
    el.addEventListener("focusout", onOut);
    return () => el.removeEventListener("focusout", onOut);
  }, []);

  const close = useCallback(() => {
    setQuery("");
    setActive(0);
    setExpanded(false);
    input.current?.blur();
  }, []);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    const next = [r.id, ...recent.filter((id) => id !== r.id)].slice(0, RECENT_MAX);
    setRecent(next);
    writeRecent(next);
    close();
    go(r.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (Math.min(i, results.length - 1) + step + results.length) % results.length);
    } else if (e.key === "Home" && results.length && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(current);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
        setActive(0);
      } else close();
    }
  };

  const optionId = (i: number) => `${uid}-o${i}`;
  let lastGroup: Group | null = null;
  const status = query
    ? results.length
      ? t(locale, results.length === 1 ? "cmdResultsOne" : "cmdResultsN", { n: results.length })
      : t(locale, alerts ? "cmdNone" : "cmdNotLoaded")
    : "";

  return (
    <div className="cmd" ref={wrap} data-expanded={expanded ? "" : undefined}>
      <button
        type="button"
        className="icon-btn cmd-trigger"
        aria-label={t(locale, "cmdOpen")}
        title={t(locale, "cmdShortcutTitle")}
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(true);
          setPing((n) => n + 1);
        }}
      >
        <SearchIcon />
      </button>
      <div className="cmd-box" role="search" aria-label={t(locale, "cmdLabel")}>
        <span className="cmd-glyph">
          <SearchIcon />
        </span>
        <input
          ref={input}
          className="cmd-input"
          type="text"
          role="combobox"
          aria-label={t(locale, "cmdLabel")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && current ? optionId(results.indexOf(current)) : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={t(locale, "cmdPlaceholder")}
          title={t(locale, "cmdShortcutTitle")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
        />
        <span className="cmd-kbd" aria-hidden="true">
          /
        </span>
        <button type="button" className="icon-btn cmd-close" aria-label={t(locale, "cmdClose")} onClick={close}>
          <CloseIcon />
        </button>
      </div>

      {showList ? (
        <div className="cmd-pop">
          {results.length ? (
            <div className="cmd-list" id={listId} role="listbox" aria-label={t(locale, "cmdResults")}>
              {results.map((r, i) => {
                const isRecent = !query.trim() && i < recent.filter((id) => entries.some((e) => e.id === id)).length;
                const section = isRecent ? "recent" : r.group;
                const header = section !== lastGroup;
                lastGroup = section as Group;
                const selected = r === current;
                return (
                  <div key={r.id} role="presentation">
                    {header ? (
                      <div className="cmd-group" role="presentation">
                        {t(locale, isRecent ? "cmdGroupLast" : query || r.group !== "alerts" ? GROUP_LABEL[r.group] : "cmdGroupRecent")}
                      </div>
                    ) : null}
                    {/* biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the combobox input */}
                    <div
                      id={optionId(i)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={selected}
                      className="cmd-option"
                      data-group={r.group}
                      // keep focus in the input so the list stays open while choosing
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseMove={() => selected || setActive(i)}
                      onClick={() => choose(r)}
                    >
                      <span className="cmd-label">{r.label}</span>
                      <span className="cmd-sub">{r.sub}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="cmd-empty">{alerts ? t(locale, "cmdNoneFor", { q: query.trim() }) : t(locale, "cmdNotLoaded")}</p>
          )}
          <p className="cmd-hints">{t(locale, "cmdHints")}</p>
          <p className="cmd-keys">{t(locale, "cmdKeys")}</p>
        </div>
      ) : null}
      <span className="cmd-status" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
