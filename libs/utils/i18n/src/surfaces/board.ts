// Copy for the researcher's board shell (spec-research.md). Keys are global: prefix them.

export const boardEn = {
  boardPanels: "Centre views",
  boardFeed: "Signals",
  boardGrid: "Unit grid",
  boardGeo: "Map",
  boardNetwork: "Hospital network",
  boardMap: "Regional map",
  boardGridShort: "Grid",
  boardGeoShort: "Map",
} as const;

export const boardFi: Record<keyof typeof boardEn, string> = {
  boardPanels: "Näkymät",
  boardFeed: "Signaalit",
  boardGrid: "Yksikköruudukko",
  boardGeo: "Kartta",
  boardNetwork: "Sairaalaverkosto",
  boardMap: "Aluekartta",
  boardGridShort: "Ruudukko",
  boardGeoShort: "Kartta",
};
