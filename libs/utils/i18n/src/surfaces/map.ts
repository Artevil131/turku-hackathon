// Copy for one surface of the web app, kept in its own file so builders of
// different surfaces never edit the same file. Keys are global: prefix them.

export const mapEn = {} as const;

export const mapFi: Record<keyof typeof mapEn, string> = {};
