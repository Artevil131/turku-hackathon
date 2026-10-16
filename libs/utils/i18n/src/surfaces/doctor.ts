// Copy for one surface of the web app, kept in its own file so builders of
// different surfaces never edit the same file. Keys are global: prefix them.

export const doctorEn = {} as const;

export const doctorFi: Record<keyof typeof doctorEn, string> = {};
