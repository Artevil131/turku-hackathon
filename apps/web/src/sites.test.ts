import type { AeiClient, Meta } from "@aei/contract";
import { HOME_SITE, WARDS } from "@aei/domain";
import { wardName } from "@aei/i18n";
import { afterEach, describe, expect, it } from "vitest";
import { flowsOf, networkUnits, recordsOf, scopeClient, selectSite, setRegistry, siteWards, validSite } from "./sites.ts";

const SATA = { id: "sata", fi: "Satasairaala", en: "Satasairaala", county: "Satakunnan hyvinvointialue" };
const two: Pick<Meta, "wards" | "sites"> = {
  sites: [HOME_SITE, SATA],
  wards: [...WARDS, { code: "sata/ICU", site: "sata", fi: "Teho-osasto", en: "Intensive care unit", type: "in", institution: "hospital" }],
};

afterEach(() => {
  setRegistry({ wards: WARDS, sites: [HOME_SITE] });
  selectSite(HOME_SITE.id);
});

describe("hospital selection in the web app (D-051)", () => {
  it("changes nothing with one hospital", () => {
    setRegistry({ wards: WARDS, sites: [HOME_SITE] });
    const client = { isolates: () => Promise.resolve() } as unknown as AeiClient;
    expect(scopeClient(client, "tyks")).toBe(client);
    expect(validSite("sata")).toBe("tyks");
  });

  it("asks for the selected hospital and cuts what the app holds to it", async () => {
    setRegistry(two);
    selectSite("sata");
    const asked: unknown[] = [];
    const client = { alerts: (q: unknown) => Promise.resolve(asked.push(q)) } as unknown as AeiClient;
    await scopeClient(client, "sata").alerts({ from: "2025-06-01" });
    expect(asked).toEqual([{ from: "2025-06-01", site: "sata" }]);
    expect(siteWards().map((w) => w.code)).toEqual(["sata/ICU"]);
    expect(recordsOf([{ ward: "URO" }, { ward: "sata/ICU" }], "sata")).toEqual([{ ward: "sata/ICU" }]);
    expect(
      flowsOf(
        [
          { from: "URO", to: "sata/ICU" },
          { from: "URO", to: "ICU" },
        ],
        "sata",
      ),
    ).toHaveLength(1);
  });

  it("names another hospital's units with the hospital and lists them after the selected one's", () => {
    setRegistry(two);
    selectSite("tyks");
    expect(wardName("fi", "sata/ICU")).toBe("Teho-osasto · Satasairaala");
    expect(wardName("fi", "ICU")).toBe("Teho-osasto");
    expect(networkUnits([{ from: "URO", to: "sata/ICU" }]).slice(-1)).toEqual(["sata/ICU"]);
    expect(validSite("all")).toBeNull();
    expect(validSite("nowhere")).toBe("tyks");
  });
});
