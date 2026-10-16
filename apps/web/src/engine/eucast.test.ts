import { describe, expect, it } from "vitest";
import { isIntrinsicallyResistant } from "./eucast.ts";

// Pairs checked against EUCAST Expected Resistant Phenotypes v1.2 (2023).
const ab = (en: string, cls = "", code = en.slice(0, 3).toUpperCase()) => ({ code, en, class: cls });
const R = (organism: string, en: string, cls = "") => isIntrinsicallyResistant(organism, ab(en, cls));

describe("isIntrinsicallyResistant: Enterobacterales (Table 1)", () => {
  it("applies the table heading to every Enterobacterales species", () => {
    expect(R("Escherichia coli", "vancomycin", "glycopeptides")).toBe(true);
    expect(R("Escherichia coli", "clindamycin", "lincosamides")).toBe(true);
    expect(R("Escherichia coli", "linezolid")).toBe(true);
    expect(R("Escherichia coli", "dalbavancin")).toBe(true);
    expect(R("Escherichia coli", "clarithromycin", "macrolides")).toBe(true);
    // Footnote 1: azithromycin and erythromycin are left out.
    expect(R("Escherichia coli", "azithromycin", "macrolides")).toBe(false);
  });

  it("does not mark antibiotics E. coli is merely not tested for", () => {
    expect(R("Escherichia coli", "ceftazidime", "cephalosporins 3rd gen")).toBe(false);
    expect(R("Escherichia coli", "ampicillin", "penicillins")).toBe(false);
    expect(R("Escherichia coli", "nitrofurantoin")).toBe(false);
  });

  it("reads the species rows", () => {
    expect(R("Klebsiella pneumoniae", "ampicillin")).toBe(true);
    expect(R("Klebsiella oxytoca", "ampicillin")).toBe(true);
    expect(R("Klebsiella pneumoniae", "cefuroxime")).toBe(false);
    expect(R("Proteus mirabilis", "nitrofurantoin", "nitrofurans")).toBe(true);
    expect(R("Proteus mirabilis", "colistin")).toBe(true);
    expect(R("Proteus mirabilis", "ampicillin")).toBe(false);
    expect(R("Citrobacter freundii", "cefoxitin")).toBe(true);
    expect(R("Citrobacter freundii", "cefuroxime")).toBe(false);
    expect(R("Citrobacter koseri", "ticarcillin")).toBe(true);
    expect(R("Enterobacter cloacae complex", "amoxicillin/clavulanic acid")).toBe(true);
    expect(R("Enterobacter cloacae", "cefazolin")).toBe(true);
    expect(R("Klebsiella aerogenes", "amoxicillin-clavulanate")).toBe(true);
    expect(R("Serratia marcescens", "cefuroxime")).toBe(true);
    expect(R("Morganella morganii", "nitrofurantoin")).toBe(true);
  });

  it("reads organism names with extra words", () => {
    expect(R("Escherichia coli ESBL", "vancomycin")).toBe(true);
    expect(R("KLEBSIELLA PNEUMONIAE", "Ampicillin")).toBe(true);
  });
});

describe("isIntrinsicallyResistant: non-fermenters (Table 2)", () => {
  it("reads Pseudomonas aeruginosa and the table heading", () => {
    const psa = "Pseudomonas aeruginosa";
    expect(R(psa, "ampicillin")).toBe(true);
    expect(R(psa, "ceftriaxone", "cephalosporins 3rd gen")).toBe(true);
    expect(R(psa, "cefuroxime", "cephalosporins 2nd gen")).toBe(true); // heading: first- and second-generation cephalosporins
    expect(R(psa, "trimethoprim")).toBe(true);
    expect(R(psa, "ertapenem")).toBe(true);
    expect(R(psa, "kanamycin")).toBe(true);
    expect(R(psa, "vancomycin")).toBe(true);
    expect(R(psa, "ceftazidime")).toBe(false);
    expect(R(psa, "meropenem")).toBe(false);
    expect(R(psa, "piperacillin-tazobactam")).toBe(false);
    expect(R(psa, "gentamicin", "aminoglycosides")).toBe(false); // footnote 5: kanamycin and neomycin only
    expect(R(psa, "trimethoprim-sulfamethoxazole")).toBe(false);
  });

  it("reads Acinetobacter and Stenotrophomonas footnotes", () => {
    expect(R("Acinetobacter baumannii", "doxycycline")).toBe(true);
    expect(R("Acinetobacter baumannii", "minocycline")).toBe(false);
    expect(R("Acinetobacter baumannii", "meropenem")).toBe(false);
    expect(R("Stenotrophomonas maltophilia", "meropenem")).toBe(true);
    expect(R("Stenotrophomonas maltophilia", "trimethoprim")).toBe(true);
    expect(R("Stenotrophomonas maltophilia", "trimethoprim/sulfamethoxazole")).toBe(false);
    expect(R("Stenotrophomonas maltophilia", "doxycycline")).toBe(false);
  });

  it("does not apply the heading to a species without a row", () => {
    expect(R("Pseudomonas putida", "vancomycin")).toBe(false);
  });
});

describe("isIntrinsicallyResistant: gram-positive bacteria (Table 4)", () => {
  it("reads staphylococci", () => {
    expect(R("Staphylococcus aureus", "ceftazidime")).toBe(true);
    expect(R("Staphylococcus aureus", "aztreonam")).toBe(true);
    expect(R("Staphylococcus aureus", "colistin", "polymyxins")).toBe(true);
    expect(R("Staphylococcus aureus", "meropenem")).toBe(false);
    expect(R("Staphylococcus aureus", "ampicillin")).toBe(false);
    expect(R("Staphylococcus aureus", "ceftriaxone")).toBe(false);
    expect(R("Staphylococcus saprophyticus", "fosfomycin")).toBe(true);
    expect(R("Staphylococcus saprophyticus", "fusidic acid")).toBe(true);
    expect(R("Staphylococcus saprophyticus", "nitrofurantoin")).toBe(false);
    expect(R("Staphylococcus epidermidis", "ceftazidime")).toBe(true);
    expect(R("Coagulase-negative staphylococci", "ceftazidime")).toBe(true);
  });

  it("reads enterococci", () => {
    expect(R("Enterococcus faecalis", "ceftriaxone", "cephalosporins 3rd gen")).toBe(true);
    expect(R("Enterococcus faecalis", "cefuroxime")).toBe(true);
    expect(R("Enterococcus faecalis", "clindamycin", "lincosamides")).toBe(true);
    expect(R("Enterococcus faecalis", "gentamicin")).toBe(true); // low-level resistance (footnote 1)
    expect(R("Enterococcus faecalis", "vancomycin")).toBe(false);
    expect(R("Enterococcus faecalis", "ampicillin")).toBe(false);
    expect(R("Enterococcus faecalis", "trimethoprim")).toBe(false);
    expect(R("Enterococcus faecalis", "nitrofurantoin")).toBe(false);
    expect(R("Enterococcus faecium", "clindamycin")).toBe(false);
    expect(R("Enterococcus faecium", "erythromycin", "macrolides")).toBe(true);
    expect(R("Enterococcus gallinarum", "vancomycin")).toBe(true);
    expect(R("Enterococcus gallinarum", "teicoplanin")).toBe(false);
  });

  it("reads streptococci", () => {
    expect(R("Streptococcus pneumoniae", "gentamicin")).toBe(true);
    expect(R("Streptococcus pyogenes", "ceftazidime")).toBe(true);
    expect(R("Streptococcus agalactiae", "ceftriaxone")).toBe(false);
    expect(R("Streptococcus pneumoniae", "vancomycin")).toBe(false);
  });
});

describe("isIntrinsicallyResistant: anything else", () => {
  it("answers false for organisms and antibiotics it does not know", () => {
    expect(R("Candida albicans", "vancomycin")).toBe(false);
    expect(R("Org E", "vancomycin")).toBe(false);
    expect(R("", "vancomycin")).toBe(false);
    expect(R("Escherichia coli", "newmycin", "new class")).toBe(false);
  });

  it("never marks a screening test", () => {
    expect(R("Citrobacter freundii", "cefoxitin (screen)", "MRSA screen")).toBe(false);
    expect(R("Citrobacter freundii", "cefoxitin")).toBe(true);
  });
});
