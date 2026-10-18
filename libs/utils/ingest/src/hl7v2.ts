import type { Phenotype, Sex, Specimen, WardCode } from "@aei/domain";
import {
  type CodeMaps,
  type Coding,
  DEFAULT_CODE_MAPS,
  interpretation,
  isNoGrowth,
  isPositive,
  mapAntibiotic,
  mapOrganism,
  mapPhenotype,
  mapSpecimen,
  mapWard,
} from "./codes.ts";
import { addCulture, type CultureInput, emptyResult, type IngestResult, type IsolateInput, isIsoDate } from "./record.ts";

// HL7 v2.5.1 ORU^R01 microbiology results (D-035), the message hospital lab
// systems send inside the hospital. Read, per culture (a parent OBR):
//   PID-3 patient id, PID-7 birth date, PID-8 sex
//   PV1-3 assigned location (ward), PV1-44 admission date
//   OBR-3 filler order number (culture id; else OBR-2), OBR-7 or SPM-17 collection time
//   SPM-4 specimen type (else OBR-15)
//   OBX organism (a coded value that maps to an organism), OBX-4 sub-id = isolate
//   OBX susceptibility: OBX-3 the antibiotic, OBX-8 (or OBX-5) S / I / R, same OBX-4 sub-id
//   OBX phenotype: OBX-3 ESBL / MRSA / VRE / CPE with a positive value
//   Child OBRs (OBR-29 set) carry an isolate's susceptibilities; OBR-26 names its organism's sub-id.

export interface Hl7Options {
  maps?: CodeMaps;
  /** EUCAST version or similar, stored with each result. */
  guideline?: string;
}

interface Delims {
  field: string;
  component: string;
  repetition: string;
  escape: string;
  sub: string;
}

function decodeEscapes(v: string, d: Delims): string {
  if (!v.includes(d.escape)) return v;
  const e = d.escape.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  return v
    .replace(new RegExp(`${e}F${e}`, "g"), d.field)
    .replace(new RegExp(`${e}S${e}`, "g"), d.component)
    .replace(new RegExp(`${e}T${e}`, "g"), d.sub)
    .replace(new RegExp(`${e}R${e}`, "g"), d.repetition)
    .replace(new RegExp(`${e}E${e}`, "g"), d.escape);
}

type Segment = { name: string; fields: string[] };

/** MLLP start (0x0B) and end (0x1C) bytes between messages. */
const MLLP_FRAMING = new RegExp(`[${String.fromCharCode(0x0b)}${String.fromCharCode(0x1c)}]`, "g");

/** Splits an ER7-encoded message into segments; `fields[n]` is field n (MSH counts its separator as MSH-1). */
export function splitHl7(message: string): { segments: Segment[]; delims: Delims } {
  const text = message.replace(/^﻿/, "").trim();
  if (!text.startsWith("MSH")) throw new Error("not an HL7 v2 message: it must start with MSH");
  const fieldSep = text[3] ?? "|";
  const enc = text.slice(4, 8);
  const delims: Delims = {
    field: fieldSep,
    component: enc[0] ?? "^",
    repetition: enc[1] ?? "~",
    escape: enc[2] ?? "\\",
    sub: enc[3] ?? "&",
  };
  const segments = text
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split(fieldSep);
      const name = parts[0] ?? "";
      // Make fields[n] the HL7 field number: MSH-1 is the separator itself.
      const fields = name === "MSH" ? [name, fieldSep, ...parts.slice(1)] : parts;
      return { name, fields };
    });
  return { segments, delims };
}

export function parseHl7Message(message: string, options: Hl7Options = {}): IngestResult {
  const maps = options.maps ?? DEFAULT_CODE_MAPS;
  const out = emptyResult();
  const { segments, delims: d } = splitHl7(message);
  const field = (s: Segment | undefined, n: number) => s?.fields[n] ?? "";
  const first = (v: string) => v.split(d.repetition)[0] ?? "";
  const comp = (v: string, n: number) => decodeEscapes(first(v).split(d.component)[n - 1] ?? "", d);
  const coding = (v: string): Coding[] => {
    const parts = first(v)
      .split(d.component)
      .map((p) => decodeEscapes(p, d));
    const out: Coding[] = [{ code: parts[0], display: parts[1], system: parts[2] }];
    if (parts[3] || parts[4]) out.push({ code: parts[3], display: parts[4], system: parts[5] });
    return out;
  };
  // Antibiotic names in LOINC displays come as "Ampicillin [Susceptibility] by ...".
  const antibioticCodings = (v: string): Coding[] =>
    coding(v).flatMap((c) => [c, { display: c.display?.split("[")[0]?.split(" by ")[0]?.trim() }]);
  // A DTM's day as YYYY-MM-DD; null when it has no day or the day is not a real one ("20251399").
  const date = (v: string) => {
    const s = comp(v, 1);
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return s.length >= 8 && isIsoDate(iso) ? iso : null;
  };
  const badDate = (v: string) => comp(v, 1).length >= 8 && !date(v);

  const msh = segments.find((s) => s.name === "MSH");
  const type = field(msh, 9);
  if (type && !comp(type, 1).startsWith("ORU")) out.warnings.push(`message type ${type} is not ORU; read anyway`);
  // The patient of a PATIENT_RESULT group: its PID and the PV1 after it.
  const readPatient = (pid: Segment | undefined, pv1: Segment | undefined) => {
    const patientId = comp(field(pid, 3), 1);
    // DTM precision may stop at the year ("1948") or month ("194803"); only the year is used.
    const birthRaw = comp(field(pid, 7), 1);
    const birthYear = /^\d{4}/.test(birthRaw) && !badDate(field(pid, 7)) ? Number(birthRaw.slice(0, 4)) : null;
    const sexCode = comp(field(pid, 8), 1).toUpperCase();
    const sex: Sex | undefined = sexCode === "F" || sexCode === "M" ? sexCode : undefined;
    const location = field(pv1, 3);
    const ward: WardCode | undefined = mapWard(maps, [
      { code: comp(location, 1) },
      { display: comp(location, 1) },
      { code: comp(location, 4) },
    ]);
    const admission = date(field(pv1, 44));
    const badAdmission = badDate(field(pv1, 44));
    if (!patientId) out.warnings.push("PID-3 patient id missing");
    if (!birthYear) out.warnings.push(birthRaw ? `PID-7 birth date "${birthRaw}" is not a real date` : "PID-7 birth date missing");
    if (!sex) out.warnings.push(`PID-8 sex "${sexCode}" is not F or M`);
    if (!ward) out.warnings.push(`PV1-3 location "${comp(location, 1)}" maps to no unit (add it to the ward map)`);
    if (badAdmission) out.warnings.push(`PV1-44 admission date "${comp(field(pv1, 44), 1)}" is not a real date`);
    return { patientId, birthYear, sex, ward, admission, badAdmission };
  };

  // Cultures: each parent OBR with the segments up to the next parent OBR, under the PID / PV1 before it.
  type Group = { obr: Segment; spm?: Segment; obx: { seg: Segment; defaultSub: string }[]; patient: ReturnType<typeof readPatient> };
  const groups: Group[] = [];
  let current: Group | undefined;
  let childSub = "";
  let pid: Segment | undefined;
  let pv1: Segment | undefined;
  let patient: ReturnType<typeof readPatient> | undefined;
  for (const s of segments) {
    if (s.name === "PID") {
      pid = s;
      pv1 = undefined;
      patient = undefined;
    } else if (s.name === "PV1") {
      pv1 = s;
      patient = undefined;
    } else if (s.name === "OBR") {
      if (field(s, 29) && current) {
        childSub = comp(field(s, 26), 2) || comp(field(s, 26), 1);
        continue;
      }
      patient ??= readPatient(pid, pv1);
      current = { obr: s, obx: [], patient };
      childSub = "";
      groups.push(current);
    } else if (s.name === "SPM" && current) current.spm = s;
    else if (s.name === "OBX" && current) current.obx.push({ seg: s, defaultSub: childSub });
  }
  if (!groups.length) out.warnings.push("no OBR segment: no culture in the message");

  // A culture id twice in one message: the last one is kept, as a later message would replace it.
  const cultures = new Map<string, CultureInput>();
  for (const g of groups) {
    const { patientId, birthYear, sex, ward, admission, badAdmission } = g.patient;
    const cultureId = comp(field(g.obr, 3), 1) || comp(field(g.obr, 2), 1);
    const sampleDate = date(field(g.spm, 17)) ?? date(field(g.obr, 7));
    const specimenField = g.spm ? field(g.spm, 4) : field(g.obr, 15);
    const specimen: Specimen | undefined = mapSpecimen(maps, coding(specimenField));
    if (!cultureId) out.warnings.push("OBR-3 / OBR-2 order number missing");
    if (!sampleDate)
      out.warnings.push(
        `culture ${cultureId}: no real collection date (SPM-17 "${comp(field(g.spm, 17), 1)}", OBR-7 "${comp(field(g.obr, 7), 1)}")`,
      );
    if (!specimen)
      out.warnings.push(`culture ${cultureId}: specimen "${comp(specimenField, 1)} ${comp(specimenField, 2)}" maps to nothing`);

    const isolates = new Map<string, IsolateInput & { phenotypesSeen: Set<Phenotype> }>();
    const pending = new Map<string, { results: IsolateInput["results"]; phenotypes: Set<Phenotype> }>();
    let noGrowth = false;
    let mixed = false;
    for (const { seg, defaultSub } of g.obx) {
      // In a child OBR, OBR-26 names the isolate; its OBX-4 numbers only the child's own observations.
      let sub = defaultSub || field(seg, 4) || "1";
      const codeField = field(seg, 3);
      const value = field(seg, 5);
      const flag = comp(field(seg, 8), 1);
      const organism = mapOrganism(maps, coding(value));
      const phenotype = mapPhenotype(maps, coding(codeField));
      const antibiotic = mapAntibiotic(maps, antibioticCodings(codeField));
      const sr = interpretation(flag) ?? interpretation(comp(value, 1));
      const bucket = () => {
        const p = pending.get(sub) ?? { results: {}, phenotypes: new Set<Phenotype>() };
        pending.set(sub, p);
        return p;
      };
      if (organism && !sr) {
        if (!defaultSub && !field(seg, 4)) {
          // Organisms with no OBX-4 are numbered in order rather than all becoming isolate 1.
          let n = 1;
          while (isolates.has(String(n))) n++;
          sub = String(n);
        } else if (isolates.has(sub)) {
          out.warnings.push(`culture ${cultureId}: two organisms under sub-id ${sub}; the later one is kept`);
        }
        isolates.set(sub, { organism, phenotypes: [], results: {}, phenotypesSeen: new Set() });
      } else if (phenotype) {
        if (isPositive(comp(value, 1)) || isPositive(comp(value, 2))) bucket().phenotypes.add(phenotype);
      } else if (antibiotic && sr) {
        bucket().results[antibiotic] = sr;
      } else if (isNoGrowth(comp(value, 1)) || isNoGrowth(comp(value, 2))) {
        noGrowth = true;
      } else if (/mixed|seka/i.test(`${comp(value, 1)} ${comp(value, 2)}`)) {
        mixed = true;
      } else {
        out.warnings.push(
          `culture ${cultureId}: OBX "${comp(codeField, 1)} ${comp(codeField, 2)}" = "${comp(value, 1)} ${comp(value, 2)}" not understood`,
        );
      }
    }
    for (const [sub, p] of pending) {
      const iso = isolates.get(sub);
      if (!iso) {
        out.warnings.push(`culture ${cultureId}: results under sub-id ${sub} have no organism`);
        continue;
      }
      Object.assign(iso.results, p.results);
      for (const ph of p.phenotypes) iso.phenotypesSeen.add(ph);
    }
    if (!cultureId || !sampleDate || !specimen || !patientId || !birthYear || !sex || !ward || badAdmission) continue;
    const culture: CultureInput = {
      cultureId,
      patientId,
      sex,
      birthYear,
      sampleDate,
      ward,
      admissionDate: admission,
      specimen,
      mixedGrowth: mixed && !isolates.size,
      isolates:
        noGrowth && !isolates.size
          ? []
          : [...isolates.values()].map((i) => ({ organism: i.organism, phenotypes: [...i.phenotypesSeen], results: i.results })),
      ...(options.guideline ? { guideline: options.guideline } : {}),
    };
    if (cultures.has(cultureId)) out.warnings.push(`culture ${cultureId} appears twice in the message; the last one is kept`);
    cultures.set(cultureId, culture);
  }
  for (const c of cultures.values()) addCulture(out, c);
  return out;
}

/** Several messages in one text, each starting at an MSH line; blank lines and MLLP framing are skipped. */
export function parseHl7Batch(text: string, options: Hl7Options = {}): IngestResult[] {
  return text
    .replace(MLLP_FRAMING, "\n")
    .split(/(?=^MSH)/m)
    .map((m) => m.trim())
    .filter((m) => m.startsWith("MSH"))
    .map((m) => parseHl7Message(m, options));
}
