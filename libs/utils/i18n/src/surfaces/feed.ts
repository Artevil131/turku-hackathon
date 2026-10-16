// Copy for one surface of the web app, kept in its own file so builders of
// different surfaces never edit the same file. Keys are global: prefix them.

export const feedEn = {} as const;

export const feedFi: Record<keyof typeof feedEn, string> = {};
