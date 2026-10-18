// Hospitals and the referral tree (central hospital -> university hospital) drawn on the county map.
// A hand-drawn diagram of the referral hierarchy, not patient data.

export interface Hospital {
  id: string;
  name: string;
  lon: number;
  lat: number;
  uni?: boolean;
  county: string;
  /** The university hospital this central hospital refers to. */
  to?: string;
}

export const HOSPITALS: Hospital[] = [
  { id: "HUS", name: "HUS Meilahti, Helsinki", lon: 24.91, lat: 60.19, uni: true, county: "Helsingin kaupunki" },
  { id: "Tyks", name: "Tyks, Turku", lon: 22.27, lat: 60.45, uni: true, county: "Varsinais-Suomen hyvinvointialue" },
  { id: "Tays", name: "Tays, Tampere", lon: 23.8, lat: 61.5, uni: true, county: "Pirkanmaan hyvinvointialue" },
  { id: "KYS", name: "KYS, Kuopio", lon: 27.63, lat: 62.89, uni: true, county: "Pohjois-Savon hyvinvointialue" },
  { id: "OYS", name: "OYS, Oulu", lon: 25.52, lat: 65.01, uni: true, county: "Pohjois-Pohjanmaan hyvinvointialue" },
  { id: "Pori", name: "Satasairaala, Pori", lon: 21.8, lat: 61.49, county: "Satakunnan hyvinvointialue", to: "Tyks" },
  { id: "Vaasa", name: "Vaasa central hospital", lon: 21.62, lat: 63.1, county: "Pohjanmaan hyvinvointialue", to: "Tyks" },
  { id: "Mariehamn", name: "Ålands centralsjukhus", lon: 19.94, lat: 60.1, county: "Ahvenanmaa", to: "Tyks" },
  { id: "Hameenlinna", name: "Kanta-Häme central hospital", lon: 24.46, lat: 61.0, county: "Kanta-Hämeen hyvinvointialue", to: "Tays" },
  { id: "Seinajoki", name: "Seinäjoki central hospital", lon: 22.84, lat: 62.79, county: "Etelä-Pohjanmaan hyvinvointialue", to: "Tays" },
  { id: "Jyvaskyla", name: "Nova, Jyväskylä", lon: 25.75, lat: 62.24, county: "Keski-Suomen hyvinvointialue", to: "KYS" },
  { id: "Mikkeli", name: "Mikkeli central hospital", lon: 27.27, lat: 61.69, county: "Etelä-Savon hyvinvointialue", to: "KYS" },
  { id: "Joensuu", name: "Siun sote, Joensuu", lon: 29.76, lat: 62.6, county: "Pohjois-Karjalan hyvinvointialue", to: "KYS" },
  { id: "Rovaniemi", name: "Lapland central hospital", lon: 25.73, lat: 66.5, county: "Lapin hyvinvointialue", to: "OYS" },
  { id: "Kajaani", name: "Kainuu central hospital", lon: 27.73, lat: 64.22, county: "Kainuun hyvinvointialue", to: "OYS" },
  { id: "Kokkola", name: "Soite, Kokkola", lon: 23.13, lat: 63.84, county: "Keski-Pohjanmaan hyvinvointialue", to: "OYS" },
  { id: "Espoo", name: "Jorvi, Espoo", lon: 24.68, lat: 60.22, county: "Länsi-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Vantaa", name: "Peijas, Vantaa", lon: 25.07, lat: 60.33, county: "Vantaan ja Keravan hyvinvointialue", to: "HUS" },
  { id: "Hyvinkaa", name: "Hyvinkää hospital", lon: 24.86, lat: 60.63, county: "Keski-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Porvoo", name: "Porvoo hospital", lon: 25.66, lat: 60.39, county: "Itä-Uudenmaan hyvinvointialue", to: "HUS" },
  { id: "Lahti", name: "Päijät-Häme central hospital", lon: 25.66, lat: 60.98, county: "Päijät-Hämeen hyvinvointialue", to: "HUS" },
  { id: "Kotka", name: "Kymenlaakso central hospital", lon: 26.95, lat: 60.47, county: "Kymenlaakson hyvinvointialue", to: "HUS" },
  {
    id: "Lappeenranta",
    name: "South Karelia central hospital",
    lon: 28.19,
    lat: 61.06,
    county: "Etelä-Karjalan hyvinvointialue",
    to: "HUS",
  },
];
const UNI_LINKS: [string, string][] = [
  ["HUS", "Tyks"],
  ["HUS", "Tays"],
  ["Tays", "Tyks"],
  ["Tays", "KYS"],
  ["KYS", "OYS"],
  ["Tays", "OYS"],
  ["HUS", "KYS"],
];
/** [from, to, weight]: referral links first, links between university hospitals lighter. */
export const LINKS: [string, string, number][] = [
  ...HOSPITALS.filter((h) => h.to).map((h): [string, string, number] => [h.id, h.to as string, 1]),
  ...UNI_LINKS.map(([a, b]): [string, string, number] => [a, b, 0.6]),
];
