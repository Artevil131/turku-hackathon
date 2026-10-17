// Copy for the guided demo tours: a cursor walks through a demo file, opens windows, uses tools and runs Python,
// and these captions say what is on screen: short, plain, a little dry. Keys are global: prefix them `tour`.

export const tourEn = {
  tourOfferTitle: "Two minutes, one cursor?",
  tourOfferBody:
    "A cursor drives this project for you: it opens windows, runs the tools and some Python, and says what each number means. Click what it points at to hurry it along.",
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

  // Shared by all three tours: whose data this is, and how to read the band at the top.
  tourYourData:
    "First, whose data: your lab's. Every number comes from the culture results the lab already sends, checked on arrival. Here they are synthetic stand-ins shaped like Tyks's.",
  tourBand:
    "This strip is the lab feed as it happens, week after week, with no year-end report to wait for. The line on the right is today.",
  tourLanes:
    "Each lane is a unit: ED the emergency department, MED-A internal medicine A, ICU intensive care. The fatter the ribbon, the more resistant finds that week.",
  tourPills:
    "Pills are signals: a unit with more than its usual. 'ESBL 3 · 0.2' reads three seen, 0.2 expected. Red flags a high-risk or first-ever find; white means samples stopped coming.",

  // Doctor
  tourClinIntro:
    "A doctor's project. A urinary tract infection on Internal medicine A, and an antibiotic needed now, days before the patient's own culture answers.",
  tourClinRecord: "Describe the patient: unit, sample, how ill. The list below recalculates for exactly that patient on this unit.",
  tourClinRow:
    "One row per antibiotic. The big number: of this unit's urine bacteria, the share the drug beat in the lab. 95 % is 95 out of 100.",
  tourClinPlot: "The dot is that share, the band its 95 % interval, the tick the bar to clear. Band above the tick: covered.",
  tourClinN: "n is how many isolates stand behind the number. 400 is evidence; 12 is gossip. Hence the band.",
  tourClinSevere: "Switch to severe and the bar goes up: guessing wrong costs more in a very ill patient. Some drugs drop out.",
  tourClinDetails:
    "Inside a row, two shares: within spectrum counts only the bacteria the drug is meant for, all organisms counts everything. Both describe past lab results, not this patient's odds.",
  tourClinSignals: "On the right, the unit's signals: this month's counts held up against an ordinary month on the same unit.",
  tourClinSignalOpen: "Open one: seen and expected side by side, so you judge the size. More than usual is not yet an outbreak.",
  tourClinAdd: "Build your own screen. Add a window lists everything a project can show.",
  tourClinMath: "The Signal window shows its working: expected, seen, and how unlikely that many would be by luck alone.",
  tourClinTools: "Statistics: the sums you would otherwise do in a spreadsheet at midnight.",
  tourClinRate:
    "Rate counts isolates per week and per 100 cultures, because a busy week of sampling finds more without anything getting worse.",
  tourClinInfer:
    "Fair to conclude: which drugs have worked on this ward lately, and how sure that is. Not fair: what this patient grows. Their own culture wins once it is back.",
  tourClinOutro: "That is the doctor's view. Your turn: change the unit, the sample or the severity, and every number follows.",

  // Infection control
  tourCtrlIntro:
    "Infection control's project, open all week, watching ESBL on Internal medicine A. A smoke detector with a notebook attached.",
  tourCtrlSlice:
    "The slice says exactly which results count: this hospital, this unit, ESBL, these dates, one isolate per patient. Same cut, same numbers, for everyone.",
  tourCtrlSignals: "The signal list: what is unusual right now, newest first.",
  tourCtrlNote: "The notebook keeps what was checked and why, in words. Thursday's colleague reads the page, not your memory.",
  tourCtrlShares:
    "Share over time: ESBL isolates over all isolates per 7-day period, with a 95 % interval. A wide interval is a thin week, where one case moves a lot.",
  tourCtrlDetector:
    "The detector asks what the live alerts ask: more ESBL than this unit usually has? It flags only gaps too big for ordinary wobble.",
  tourCtrlGraph:
    "Patient flow, from the same records: where this unit's patients came from and went next. Thick lines are busy corridors, and spread travels them.",
  tourCtrlMap: "The map puts the hospital in its region with THL's public county figures: a local fire, or weather everywhere?",
  tourCtrlAdd: "The plus between cells adds anything: a note, a slice, Python, or a statistics tool.",
  tourCtrlCompare:
    "Compare: is the ESBL share in these weeks higher than in the weeks before? It answers in a sentence, then shows its work.",
  tourCtrlCompareRead:
    "The difference is in percentage points: 5 % to 12 % is 7 points. If the interval includes zero, the data cannot tell the periods apart, however dramatic they look.",
  tourCtrlWindow: "One more window: the unit grid puts this unit beside every other one, on the same scale.",
  tourCtrlInfer:
    "Fair to conclude: something changed, when, and where. Not from this alone: who passed it to whom. That takes lab typing and a ward visit, hence the to-do list.",
  tourCtrlOutro: "That is the weekly watch. Leave it open; on Monday it shows the new week.",

  // Researcher
  tourResIntro:
    "A researcher's project, frozen on 30 April 2025: the data stop at that date, so every number here can be reproduced next year.",
  tourResQuestion:
    "Question first, in words; then the slice that answers it: ESBL on Internal medicine A, March to April, one isolate per patient.",
  tourResRate:
    "Rate: isolates per week with an exact Poisson interval, and per 100 cultures, so a sampling spree is not mistaken for an epidemic.",
  tourResCompare:
    "Compare: these weeks against the 61 days before. Words first, then the difference in percentage points, the ratio of weekly counts and a trend test.",
  tourResBeta:
    "Belief: a Beta distribution for the true ESBL share, given k resistant of n tested. Its 95 % interval is where the truth most plausibly hides.",
  tourResDetector: "The detector: what the live alerts would have flagged in this frame, with their everyday thresholds.",
  tourResCode: "Every result comes with code. This is the detector's, ready to copy into a longer script or open in Reproduce.",
  tourResNew: "Python also runs right here, in the browser, on the same data. The plus adds a cell.",
  tourResType: "A short script: weekly counts up to the cut, ESBL per 100 cultures, plotted.",
  tourResRun: "Run starts Python inside the page. The first run brings Python and pandas along, so give it a few seconds.",
  tourResOutput:
    "Table and figure land under the cell. Per 100 cultures, not per patient, and thin weeks jump: that is why the tools print intervals.",
  tourResReproduce: "Reproduce hands over the frozen cut and the exact code, Python or R, so a reviewer can check your homework.",
  tourResInfer:
    "Fair to conclude: whether a rise beats chance, when it began, and where. Not from these data alone: the cause, or that one strain spread. That takes lab typing.",
  tourResOutro:
    "That is the researcher's view: a question, a fixed cut of your lab's data, the numbers and the code behind them. Over to you.",
};

export const tourFi: Record<keyof typeof tourEn, string> = {
  tourOfferTitle: "Kaksi minuuttia, yksi kursori?",
  tourOfferBody:
    "Kursori ajaa projektin puolestasi: avaa ikkunoita, käyttää työkaluja ja vähän Pythonia, ja kertoo mitä kukin luku tarkoittaa. Klikkaa sitä mihin se osoittaa, niin homma etenee nopeammin.",
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
    "Ensin: kenen aineisto? Teidän laboratorionne. Jokainen luku tulee viljelyvastauksista, jotka laboratorio jo lähettää, ja ne tarkistetaan saapuessaan. Tässä ne ovat synteettisiä, Tyksin kaltaisia sijaisia.",
  tourBand:
    "Tämä nauha on laboratoriovirta sitä mukaa kuin se tulee, viikko viikolta, ilman vuosiraportin odottelua. Oikean reunan viiva on tämä päivä.",
  tourLanes:
    "Jokainen kaista on yksikkö: ED päivystys, MED-A sisätaudit A, ICU teho-osasto. Mitä paksumpi nauha, sitä enemmän resistenttejä löydöksiä sillä viikolla.",
  tourPills:
    "Pillerit ovat signaaleja: yksikössä tavallista enemmän. 'ESBL 3 · 0,2' tarkoittaa kolme havaittua, 0,2 odotettua. Punainen on riskibakteeri tai ensilöydös; valkoinen kertoo, että näytteitä ei tullut.",

  tourClinIntro:
    "Lääkärin projekti. Virtsatieinfektio Sisätaudit A:lla, ja antibiootti tarvitaan nyt, päiviä ennen kuin potilaan oma viljely vastaa.",
  tourClinRecord: "Kuvaa potilas: yksikkö, näyte, kuinka sairas. Alla oleva lista lasketaan juuri tälle potilaalle tässä yksikössä.",
  tourClinRow:
    "Yksi rivi antibioottia kohti. Iso luku: yksikön virtsabakteereista se osuus, johon lääke laboratoriossa tehosi. 95 % on 95 sadasta.",
  tourClinPlot: "Piste on osuus, nauha sen 95 %:n väli ja viiva ylitettävä raja. Nauha viivan yläpuolella: kattaa.",
  tourClinN: "n kertoo, montako löydöstä luvun takana on. 400 on näyttöä, 12 on juoru. Siksi nauha.",
  tourClinSevere: "Vaihda vaikeaksi, niin raja nousee: väärä arvaus maksaa enemmän hyvin sairaalla. Osa lääkkeistä putoaa.",
  tourClinDetails:
    "Rivin sisällä kaksi osuutta: kattavuusalueella laskee vain bakteerit, joihin lääke on tarkoitettu, kaikki bakteerit laskee kaiken. Molemmat kuvaavat menneitä tuloksia, eivät tämän potilaan mahdollisuuksia.",
  tourClinSignals: "Oikealla yksikön signaalit: tämän kuun määrät verrattuna saman yksikön tavalliseen kuukauteen.",
  tourClinSignalOpen: "Avaa yksi: havaittu ja odotettu rinnakkain, niin arvioit koon itse. Tavallista enemmän ei ole vielä epidemia.",
  tourClinAdd: "Rakenna oma näkymä. Lisää ikkuna listaa kaiken, mitä projekti voi näyttää.",
  tourClinMath: "Signaali-ikkuna näyttää laskunsa: odotettu, havaittu ja kuinka epätodennäköistä niin moni olisi pelkällä tuurilla.",
  tourClinTools: "Tilastot: laskut, jotka muuten tekisit taulukkolaskennassa keskiyöllä.",
  tourClinRate:
    "Määrä laskee löydökset viikossa ja sataa viljelyä kohti, koska vilkas näytteenottoviikko löytää enemmän, vaikka mikään ei pahenisi.",
  tourClinInfer:
    "Reilu päätelmä: mitkä lääkkeet ovat viime aikoina tehonneet tällä osastolla ja kuinka varmasti. Ei reilu: mitä tältä potilaalta kasvaa. Hänen oma viljelynsä voittaa, kun se valmistuu.",
  tourClinOutro: "Tämä on lääkärin näkymä. Sinun vuorosi: vaihda yksikkö, näyte tai vaikeusaste, niin jokainen luku seuraa.",

  tourCtrlIntro:
    "Infektioiden torjunnan projekti, auki koko viikon, vahtii ESBL:ää Sisätaudit A:lla. Palovaroitin, jossa on muistio mukana.",
  tourCtrlSlice:
    "Rajaus kertoo tarkalleen, mitkä tulokset lasketaan: tämä sairaala, tämä yksikkö, ESBL, nämä päivät, yksi löydös potilasta kohti. Sama leikkaus, samat luvut kaikille.",
  tourCtrlSignals: "Signaalilista: mikä on nyt tavallisesta poikkeavaa, uusin ensin.",
  tourCtrlNote: "Muistio kertoo sanoin, mitä tarkistettiin ja miksi. Torstain kollega lukee sivun, ei sinun muistiasi.",
  tourCtrlShares:
    "Osuus ajan yli: ESBL-löydökset kaikista löydöksistä 7 päivän jaksoissa, 95 %:n välin kanssa. Leveä väli on ohut viikko, jolla yksi tapaus liikuttaa paljon.",
  tourCtrlDetector:
    "Tunnistin kysyy saman kuin live-hälytykset: enemmän ESBL:ää kuin yksikössä tavallisesti? Se nostaa esiin vain erot, jotka ovat liian suuria tavalliseksi heilunnaksi.",
  tourCtrlGraph:
    "Potilasvirta samoista tiedoista: mistä yksikön potilaat tulivat ja minne he menivät. Paksut viivat ovat vilkkaita käytäviä, ja leviäminen kulkee niitä pitkin.",
  tourCtrlMap: "Kartta asettaa sairaalan alueelleen THL:n julkisilla maakuntaluvuilla: paikallinen tulipalo vai sää kaikkialla?",
  tourCtrlAdd: "Solujen välinen plus lisää mitä vain: muistiinpanon, rajauksen, Pythonia tai tilastotyökalun.",
  tourCtrlCompare: "Vertaa: onko ESBL-osuus näinä viikkoina suurempi kuin edeltävinä? Se vastaa lauseella ja näyttää sitten laskunsa.",
  tourCtrlCompareRead:
    "Ero on prosenttiyksiköissä: 5 %:sta 12 %:iin on 7 yksikköä. Jos väli sisältää nollan, aineisto ei erota jaksoja, vaikka ne näyttäisivät kuinka dramaattisilta.",
  tourCtrlWindow: "Vielä yksi ikkuna: yksikköruudukko asettaa tämän yksikön kaikkien muiden rinnalle samalla asteikolla.",
  tourCtrlInfer:
    "Reilu päätelmä: jokin muuttui, milloin ja missä. Ei pelkästään tästä: kuka tartutti kenet. Siihen tarvitaan tyypitys ja käynti osastolla, siksi tehtävälista.",
  tourCtrlOutro: "Tämä on viikkoseuranta. Jätä se auki; maanantaina se näyttää uuden viikon.",

  tourResIntro:
    "Tutkijan projekti, jäädytetty 30.4.2025: aineisto loppuu siihen päivään, joten jokainen luku on toistettavissa vielä ensi vuonna.",
  tourResQuestion:
    "Ensin kysymys sanoin, sitten siihen vastaava rajaus: ESBL Sisätaudit A:lla, maalis–huhtikuu, yksi löydös potilasta kohti.",
  tourResRate:
    "Määrä: löydökset viikossa tarkalla Poisson-välillä ja sataa viljelyä kohti, jottei näytteenottoinnostusta luulla epidemiaksi.",
  tourResCompare:
    "Vertaa: nämä viikot edeltäviä 61 päivää vasten. Ensin sanoin, sitten ero prosenttiyksikköinä, viikkomäärien suhde ja trenditesti.",
  tourResBeta:
    "Uskomus: Beta-jakauma todelliselle ESBL-osuudelle, kun n:stä testatusta k oli resistenttejä. Sen 95 %:n väli on se, missä totuus uskottavimmin piileskelee.",
  tourResDetector: "Tunnistin: mitä live-hälytykset olisivat nostaneet esiin tällä jaksolla tavallisilla kynnyksillään.",
  tourResCode:
    "Jokaisella tuloksella on koodinsa. Tämä on tunnistimen, valmiina kopioitavaksi pidempään skriptiin tai avattavaksi Toista-ikkunassa.",
  tourResNew: "Python toimii myös tässä selaimessa samalla aineistolla. Plus lisää solun.",
  tourResType: "Lyhyt skripti: viikkomäärät leikkauspäivään asti, ESBL sataa viljelyä kohti, kuvaajana.",
  tourResRun: "Aja käynnistää Pythonin sivun sisällä. Ensimmäinen ajo tuo Pythonin ja pandasin mukanaan, joten anna sille hetki.",
  tourResOutput:
    "Taulukko ja kuva tulevat solun alle. Sataa viljelyä kohti, ei potilasta kohti, ja ohuet viikot hyppivät: siksi työkalut näyttävät välit.",
  tourResReproduce:
    "Toista antaa jäädytetyn aineiston ja täsmälleen saman koodin Pythonina tai R:nä, jotta arvioija voi tarkistaa läksysi.",
  tourResInfer:
    "Reilu päätelmä: ylittääkö nousu sattuman, milloin se alkoi ja missä. Ei pelkästään tästä aineistosta: syy, tai että yksi kanta levisi. Siihen tarvitaan tyypitys.",
  tourResOutro:
    "Tämä on tutkijan näkymä: kysymys, kiinteä leikkaus laboratorion aineistosta, luvut ja niiden takana oleva koodi. Sinun vuorosi.",
};
