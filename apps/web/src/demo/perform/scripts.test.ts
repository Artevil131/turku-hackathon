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

  it("plays the doctor's and the researcher's fill-in exactly as their replay buttons do, each after its file is opened", () => {
    for (const locale of ["en", "fi"] as const) {
      const { beats } = showcaseScreenplay(locale);
      const sceneAt = (name: string) => beats.findIndex((b) => b.do === "scene" && b.name === name);
      /** The beats of a scene between the demos' pace being switched on and off: the embedded fill. */
      const embedded = (scene: string, next: string) => {
        const part = beats.slice(sceneAt(scene), sceneAt(next));
        const on = part.findIndex((b) => b.do === "pace" && b.pace === PACE);
        const off = part.findIndex((b, i) => i > on && b.do === "pace");
        expect(on).toBeGreaterThan(0);
        expect(off).toBeGreaterThan(on);
        return { prefix: part.slice(0, on), fill: part.slice(on + 1, off), suffix: part.slice(off + 1) };
      };
      // Targets made by `added()` and `last()` are fresh closures each time: compared by their source text.
      const shape = (list: Beat[]) => JSON.stringify(list, (_k, v) => (typeof v === "function" ? `fn:${v.toString()}` : v));
      const doctor = embedded("doctor", "search");
      expect(shape(doctor.fill)).toBe(shape(screenplayFor("clinician", locale).beats));
      // After the fill only a hold on what it left on screen, so the voice can finish (no further action).
      expect(doctor.suffix.map((b) => b.do)).toEqual(["look"]);
      // The prefix only opens the file: the scene mark, the card's click and a breath.
      expect(doctor.prefix.map((b) => b.do)).toEqual(["scene", "click", "think"]);
      const research = embedded("research", "export");
      expect(shape(research.fill)).toBe(shape(screenplayFor("researcher", locale).beats));
      expect(research.fill.length).toBe(screenplayFor("researcher", locale).beats.length);
      expect(research.suffix.map((b) => b.do)).toEqual(["look"]);
      expect(research.prefix.map((b) => b.do)).toEqual(["scene", "click", "think", "look"]);
    }
    expect(SHOWCASE_FILLS).toEqual(["clinician", "researcher"]);
  });

  it("shows an anomaly and the maths behind it: the pill, the card's numbers, the formula, the Poisson bars, the counts", () => {
    const { beats } = showcaseScreenplay("en");
    const from = beats.findIndex((b) => b.do === "scene" && b.name === "anomaly");
    const to = beats.findIndex((b) => b.do === "scene" && b.name === "map");
    const part = beats.slice(from + 1, to);
    expect(part[0]).toMatchObject({ do: "click", wait: ".sig .sig-tiles" });
    const looked = part.flatMap((b) => (b.do === "look" && typeof b.at === "string" ? [b.at] : []));
    expect(looked).toEqual([".sig .sig-tiles", ".sig .sig-how[open] .sig-formula", ".sig .math-poisson", ".sig .sig-counts"]);
    // Each held long enough to say a sentence over.
    for (const b of part) if (b.do === "look") expect(b.ms ?? 0).toBeGreaterThanOrEqual(2500);
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
        const orbit = "orbit" in b && typeof b.orbit === "number" && b.orbit ? 1600 : 0;
        return s + (b.do === "think" ? b.ms : b.do === "look" ? (b.ms ?? 1000) + orbit : b.do === "orbit" ? (b.ms ?? 1600) : orbit);
      }, 0) / 1000;
    expect(held).toBeGreaterThan(55);
    expect(held).toBeLessThan(90);
    // The estimate overshoots a real run (it budgets every wait in full); the lock's safety timeout is sized from it.
    const seconds = estimateMs(beats) / 1000;
    expect(seconds).toBeGreaterThan(120);
    // A real run is about 150 s; the budget above it is the waits the estimate counts in full.
    expect(seconds).toBeLessThan(340);
    // Held long enough to speak over: the last beat is the final frame.
    expect(beats.at(-1)).toEqual({ do: "outro", ms: 4000 });
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
