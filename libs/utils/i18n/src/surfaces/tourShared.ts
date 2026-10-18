// Copy shared by every tour: the offer, the controls, and the four lines that read the data line and the band.
// Short, plain, a little dry. Keys are global: prefix `tour`. English and Finnish carry the same keys.

export const tourSharedEn = {
  tourOfferTitle: "Take the tour?",
  tourEmptyKicker: "Your own",
  tourEmptyTitle: "Start an empty one?",
  tourEmptyBody: "The same windows as this demo, nothing filled in.",
  tourEmptyStart: "Start empty",
  tourOfferBody:
    "A cursor drives the project: it opens windows, runs the tools and says what each number means. Click where it points to move faster.",
  tourOfferPlay: "Watch the tour",
  tourOfferSkip: "Explore on my own",
  tourLabel: "Guided tour",
  tourStep: "Step {n} of {total}",
  tourPause: "Pause",
  tourResume: "Resume",
  tourNext: "Next",
  tourExit: "Leave the tour",
  tourDone: "Close",
  tourKeys: "Space pauses, → skips ahead, Esc leaves.",
  tourYourData:
    "The numbers come from the culture results your lab already sends, checked on arrival; this line is the checks' verdict. Here the data is synthetic, shaped like Tyks's.",
  tourBand:
    "The strip is the lab feed week by week: resistant finds by type, cultures as a line. The bar on the right is the clock, the date the replay has reached.",
  tourLanes:
    "One lane per unit, labelled by its code: ED is the emergency department, ICU intensive care. The thicker the ribbon, the more resistant finds that week.",
  tourPills:
    "A pill is a signal: 'ESBL 7 · 1.4' means 7 found where 1.4 is usual. Red is CPE or a unit's first find; white and dashed means samples fell or stopped.",
};

export const tourSharedFi: Record<keyof typeof tourSharedEn, string> = {
  tourOfferTitle: "Katsotko esittelyn?",
  tourEmptyKicker: "Oma",
  tourEmptyTitle: "Aloitetaanko tyhjästä?",
  tourEmptyBody: "Samat ikkunat kuin tässä esimerkissä, ei mitään valmiiksi täytettynä.",
  tourEmptyStart: "Aloita tyhjästä",
  tourOfferBody:
    "Kursori ajaa projektin: se avaa ikkunat, käyttää työkaluja ja kertoo, mitä kukin luku tarkoittaa. Klikkaa sitä, mihin se osoittaa, niin esittely etenee nopeammin.",
  tourOfferPlay: "Katso esittely",
  tourOfferSkip: "Tutustun itse",
  tourLabel: "Esittely",
  tourStep: "Vaihe {n}/{total}",
  tourPause: "Tauko",
  tourResume: "Jatka",
  tourNext: "Seuraava",
  tourExit: "Lopeta esittely",
  tourDone: "Sulje",
  tourKeys: "Välilyönti pysäyttää, → siirtyy eteenpäin, Esc lopettaa.",
  tourYourData:
    "Luvut tulevat viljelyvastauksista, jotka laboratorionne jo lähettää, ja ne tarkistetaan saapuessaan; tämä rivi on tarkistusten tulos. Tässä aineisto on synteettistä, Tyksin aineiston kaltaista.",
  tourBand:
    "Nauha on laboratorion virta viikko viikolta: resistentit löydökset tyypeittäin, viljelyt viivana. Oikean reunan palkki on kello, päivä johon toisto on edennyt.",
  tourLanes:
    "Yksi kaista yksikköä kohti, tunnuksella merkittynä: ED on päivystys, ICU teho-osasto. Mitä paksumpi nauha, sitä enemmän resistenttejä löydöksiä sillä viikolla.",
  tourPills:
    "Merkki kaistalla on signaali: 'ESBL 7 · 1,4' tarkoittaa 7 löydöstä, kun tavallisesti niitä on 1,4. Punainen on CPE tai yksikön ensimmäinen löydös; valkoinen katkoviivareunus kertoo, että näytteitä tuli vähemmän tai ei lainkaan.",
};
