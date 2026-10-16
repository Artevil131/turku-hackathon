import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  fromDayNumber,
  isIsoDate,
  maxDate,
  minDate,
  monthEnd,
  monthStart,
  monthsBetween,
  toDayNumber,
  weekStart,
} from "./dates.ts";

describe("dates", () => {
  it("adds days across months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2026-03-10", -28)).toBe("2026-02-10");
    expect(addDays("2026-03-10", 0)).toBe("2026-03-10");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-03")).toBe(2);
    expect(daysBetween("2026-01-03", "2026-01-01")).toBe(-2);
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
  });

  it("round-trips day numbers", () => {
    expect(toDayNumber("1970-01-01")).toBe(0);
    for (const iso of ["2023-10-02", "2024-02-29", "2026-09-27"]) expect(fromDayNumber(toDayNumber(iso))).toBe(iso);
    expect(() => toDayNumber("2026-1-1")).toThrow();
  });

  it("finds month starts and ends", () => {
    expect(monthStart("2026-03-17")).toBe("2026-03-01");
    expect(monthEnd("2024-02-10")).toBe("2024-02-29");
    expect(monthEnd("2025-02-10")).toBe("2025-02-28");
    expect(monthEnd("2026-12-05")).toBe("2026-12-31");
  });

  it("adds months, clamping the day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-01", -3)).toBe("2025-12-01");
    expect(addMonths("2026-03-01", -15)).toBe("2024-12-01");
    expect(addMonths("2025-11-15", 14)).toBe("2027-01-15");
    expect(monthsBetween("2025-12-31", "2026-02-01")).toBe(2);
  });

  it("finds the Monday of the week", () => {
    expect(weekStart("2026-10-16")).toBe("2026-10-12"); // a Friday
    expect(weekStart("2026-10-12")).toBe("2026-10-12"); // a Monday
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // a Sunday
    expect(weekStart("1970-01-01")).toBe("1969-12-29");
  });

  it("validates and compares", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2025-2-1")).toBe(false);
    expect(minDate("2026-01-02", "2025-12-31")).toBe("2025-12-31");
    expect(maxDate("2026-01-02", "2025-12-31")).toBe("2026-01-02");
  });
});
