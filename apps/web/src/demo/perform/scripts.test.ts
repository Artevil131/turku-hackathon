import { describe, expect, it } from "vitest";
import { estimateMs } from "./Performance.tsx";
import { type Beat, PACE } from "./script.ts";
import { rawScreenplayFor, SHOWCASE_FILLS, SHOWCASE_SCENES, screenplayFor, showcaseScreenplay } from "./scripts.ts";

// The screenplays are data the player reads; these checks keep them playable: every scene of the showcase is marked
// once, in the pitch's order, each scene opens on a beat the show cannot skip, and the whole stays near two minutes.

const scenesOf = (beats: readonly Beat[]) => beats.flatMap((b) => (b.do === "scene" ? [b.name] : []));

describe("the showcase screenplay", () => {
  it("marks every scene once, in order", () => {
    for (const locale of ["en", "fi"] as const) expect(scenesOf(showcaseScreenplay(locale).beats)).toEqual([...SHOWCASE_SCENES]);
  });

  it("plays the doctor's and the researcher's own fill-in on the way, each after its file is opened", () => {
    const { beats } = showcaseScreenplay("en");
    const index = (pred: (b: Beat) => boolean) => beats.findIndex(pred);
    const opensClinician = index((b) => b.do === "click" && b.at === '.start-demo[data-demo="clinician"]');
    const firstClinicianBeat = index((b) => b.do === "pick" && b.at === ".rs-unit .rs-select");
    const opensResearcher = index((b) => b.do === "click" && b.at === '.sb-demo[data-demo="researcher"]');
    const firstResearcherBeat = index((b) => b.do === "type" && b.text.startsWith("## "));
    expect(opensClinician).toBeGreaterThan(0);
    expect(firstClinicianBeat).toBeGreaterThan(opensClinician);
    expect(opensResearcher).toBeGreaterThan(firstClinicianBeat);
    expect(firstResearcherBeat).toBeGreaterThan(opensResearcher);
    expect(SHOWCASE_FILLS).toEqual(["clinician", "researcher"]);
  });

  it("scans the things it comes to before acting on them", () => {
    const { beats } = showcaseScreenplay("en");
    const scans = beats.filter((b) => b.do === "orbit" || ("orbit" in b && (b.orbit ?? 0) > 0));
    expect(scans.length).toBeGreaterThanOrEqual(10);
  });

  it("opens each page it visits on a beat the show cannot do without", () => {
    const { beats } = showcaseScreenplay("en");
    const openers = beats.filter(
      (b) => b.do === "click" && typeof b.at === "string" && /sb-demo|data-page-data|data-search|pm-export/.test(b.at),
    );
    expect(openers.length).toBeGreaterThanOrEqual(5);
    for (const b of openers) expect(b).toMatchObject({ must: true });
  });

  it("reads the same in both languages, typing the locale's own search", () => {
    const en = showcaseScreenplay("en").beats;
    const fi = showcaseScreenplay("fi").beats;
    expect(fi.length).toBe(en.length);
    // The first thing typed is the search (the notes after it are the researcher demo's own, in its language).
    const typed = (beats: Beat[]) => beats.flatMap((b) => (b.do === "type" ? [b] : []));
    expect(typed(en)[0]?.text).toBe("urology e. coli");
    expect(typed(fi)[0]?.text).toBe("urologia e. coli");
    expect(typed(fi).length).toBe(typed(en).length);
    // The search list closes on blur: the hand stays in the field until it picks a result.
    expect(typed(en)[0]?.stay).toBe(true);
  });

  it("is paced for a narration: slower than the demos and roughly two minutes by the player's own estimate", () => {
    const { pace, beats } = showcaseScreenplay("en");
    expect(pace.min).toBeGreaterThan(PACE.min);
    expect(pace.cps).toBeLessThan(PACE.cps);
    // The time held for the voice (reading, scanning and pauses; a scan about 1.6 s) is roughly half the two minutes; the
    // travel, the typing and the app's own answers are the rest.
    const held =
      beats.reduce((s, b) => {
        const orbit = "orbit" in b && b.orbit ? 1600 : 0;
        return s + (b.do === "think" ? b.ms : b.do === "look" ? (b.ms ?? 1000) + orbit : b.do === "orbit" ? (b.ms ?? 1600) : orbit);
      }, 0) / 1000;
    expect(held).toBeGreaterThan(55);
    expect(held).toBeLessThan(90);
    // The estimate overshoots a real run (it budgets every wait in full); the lock's safety timeout is sized from it.
    const seconds = estimateMs(beats) / 1000;
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(320);
    // Held long enough to speak over: the last beat is the final frame.
    expect(beats.at(-1)).toEqual({ do: "think", ms: 3000 });
  });

  it("the demo screenplays still play faster than written", () => {
    const written = rawScreenplayFor("control", "en").beats;
    const played = screenplayFor("control", "en").beats;
    expect(played.length).toBe(written.length);
    let thinks = 0;
    for (const [i, b] of played.entries()) {
      const w = written[i];
      if (b.do === "think" && w?.do === "think") {
        thinks++;
        expect(b.ms).toBeLessThan(w.ms);
      }
    }
    expect(thinks).toBeGreaterThan(0);
  });
});
