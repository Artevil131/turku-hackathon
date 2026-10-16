// Copy for the researcher's board shell (spec-research.md). Keys are global: prefix them.

export const boardEn = {
  boardPanels: "Board views",
  boardFeed: "Signals",
  boardGrid: "Unit grid",
  boardNetwork: "Hospital network",
  boardMap: "Regional map",
} as const;

export const boardFi: Record<keyof typeof boardEn, string> = {
  boardPanels: "Näkymät",
  boardFeed: "Signaalit",
  boardGrid: "Yksikköruudukko",
  boardNetwork: "Sairaalaverkosto",
  boardMap: "Aluekartta",
};
