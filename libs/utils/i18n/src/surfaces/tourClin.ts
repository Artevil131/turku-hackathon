// Copy for the Doctor tour (a cursor walks the coverage window).
// Short, plain, a little dry. Keys are global: prefix `tour`. English and Finnish carry the same keys.

export const tourClinEn = {
  tourClinIntro:
    "A urinary tract infection on Internal medicine A, an antibiotic needed today, the culture days away. The card on top answers first: of the drugs that clear the bar, mecillinam has the highest coverage, 97 % of first isolates. The doctor decides.",
  tourClinRecord:
    "The case is three choices: ward, sample, severity. Change ward, sample or severity opens them; the card and the list recalculate for that case.",
  tourClinRow:
    "One row per antibiotic. The big number: of this ward's past urine isolates, the share the drug covered in the lab. 97 % is 97 in 100.",
  tourClinPlot: "The dot is that share, the band its 95 % interval, the dashed line the 80 % bar. Whole band above the line: clears.",
  tourClinN:
    "n is how many isolates stand behind the number, here 355. 400 is evidence, 12 is gossip; under 30 the list shows no share at all.",
  tourClinSevere:
    "Severe raises the bar from 80 to 90 %: a wrong first choice costs more in a very ill patient. Watch which rows drop below the line.",
  tourClinDetails:
    "Details for one drug: which likely organisms it misses, its share over all organisms, the last 28 days, and what else failed when it failed.",
  tourClinSignals:
    "Signals: units with more resistant finds than their own usual in the last 28 days. A cluster on your ward changes what counts as likely.",
  tourClinSignalOpen:
    "Open one: patients seen beside the ward's usual count, with the dates. More than usual is a reason to look, not yet an outbreak.",
  tourClinAdd: "Add a window lists every kind this project can show. Pick what you want beside the coverage list.",
  tourClinMath:
    "The Signal window shows its working: the usual count as a curve, the seen count on it, and the shaded tail is the chance of that many by luck.",
  tourClinTools:
    "Statistics opens the tools: Rate, Compare, Share over time, Belief, Detector. The sums you would otherwise do in a spreadsheet at midnight.",
  tourClinRate:
    "Rate: isolates per week and per 100 cultures, each with an interval. A busy sampling week finds more without anything getting worse; per 100 corrects that.",
  tourClinInfer:
    "Fair to read off: which drugs covered this ward's recent isolates, and how surely. Not: what this patient grows. Their culture decides once it is back.",
  tourClinOutro: "That is the doctor's view. Yours now: Change ward, sample or severity, and every number follows.",
};

export const tourClinFi: Record<keyof typeof tourClinEn, string> = {
  tourClinIntro:
    "Virtsatieinfektio Sisätaudit A:lla, antibiootti tarvitaan tänään, viljely valmistuu vasta päivien päästä. Ylin kortti vastaa ensin: rajan ylittävistä lääkkeistä mesillinaamilla on suurin kattavuus, 97 % ensilöydöksistä. Lääkäri päättää.",
  tourClinRecord:
    "Tapaus on kolme valintaa: yksikkö, näyte, vaikeusaste. Ne avautuvat painikkeesta Muuta yksikköä, näytettä tai vaikeusastetta; kortti ja lista lasketaan uudelleen.",
  tourClinRow:
    "Yksi rivi antibioottia kohti. Iso luku on se osuus yksikön aiemmista virtsalöydöksistä, jonka lääke kattoi laboratoriossa: 97 % on 97 sadasta.",
  tourClinPlot: "Piste on osuus, nauha sen 95 %:n väli, katkoviiva 80 %:n raja. Kun koko nauha on viivan yläpuolella, lääke ylittää rajan.",
  tourClinN:
    "n kertoo, montako löydöstä luvun takana on: tässä 355. 400 on näyttöä, 12 on juoru; alle 30 löydöksellä lista ei näytä osuutta lainkaan.",
  tourClinSevere:
    "Vaikea nostaa rajan 80:stä 90 %:iin: väärä ensivalinta maksaa enemmän hyvin sairaalla potilaalla. Katso, mitkä rivit putoavat viivan alle.",
  tourClinDetails:
    "Yhden lääkkeen tiedot: mitkä todennäköiset bakteerit jäävät kattamatta, osuus kaikista bakteereista, viimeiset 28 päivää ja mikä muu petti samalla kertaa.",
  tourClinSignals:
    "Signaalit: yksiköt, joissa resistenttejä löydöksiä on 28 päivässä tavallista enemmän. Ryväs omalla osastolla muuttaa sen, mikä on todennäköistä.",
  tourClinSignalOpen:
    "Avaa yksi: havaitut potilaat yksikön tavallisen määrän rinnalla, päivämäärineen. Tavallista enemmän on syy katsoa, ei vielä epidemia.",
  tourClinAdd:
    "Lisää ikkuna luettelee kaikki ikkunatyypit, jotka projekti voi näyttää. Valitse kattavuuslistan viereen se, mitä tarvitset.",
  tourClinMath:
    "Signaali-ikkuna näyttää laskunsa: tavallinen määrä käyränä, havaittu määrä sen päällä, ja väritetty häntä on todennäköisyys saada näin monta pelkällä sattumalla.",
  tourClinTools:
    "Tilastot avaa työkalut: Määrä, Vertaa, Osuus ajan yli, Uskomus, Tunnistin. Laskut, jotka muuten tekisit taulukkolaskennassa keskiyöllä.",
  tourClinRate:
    "Määrä: löydöksiä viikossa ja sataa viljelyä kohti, kummallakin luottamusväli. Vilkas näytteenottoviikko löytää enemmän, vaikka mikään ei pahenisi; sataa kohti korjaa sen.",
  tourClinInfer:
    "Tästä voi lukea, mitkä lääkkeet kattoivat osaston tuoreet löydökset ja kuinka varmasti. Ei sitä, mitä tältä potilaalta kasvaa: hänen viljelynsä ratkaisee, kun se valmistuu.",
  tourClinOutro: "Tämä oli lääkärin näkymä. Nyt sinä: Muuta yksikköä, näytettä tai vaikeusastetta, niin jokainen luku seuraa.",
};
