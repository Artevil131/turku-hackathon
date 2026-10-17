# Sleepy-researcher critique of #research

Commit: afced57 · Time: 2026-10-17 17:59 EEST · Build: http://localhost:5181 · Browser: built-in, 1440×900 and 390×844, Finnish (English checked for copy).
Method: clicked and ran what is listed; DOM sizes read with script. Items marked (not measured) come from a screenshot only. Section "Not exercised" lists what I did not reach.

Counts: severity 3 = 8, severity 2 = 22, severity 1 = 9.

## Severity 3 (a sleepy researcher gives up or is misled)

**S3-1 · Compare result, row "Viikkomäärä, A ÷ B"**
Irritates: shows `–` as the value and `95 %:n luottamusväli 1,44–– · p 0,016` because B is 0/43; a ratio with no number and an open interval reads as a bug.
Fix: when B's weekly count is 0 replace the row with `A ÷ B: ei määritelty (B = 0) · alaraja 1,44` and hide the p or label it; never print `––`.

**S3-2 · Rate / any tool after "Avaa Työkaluissa →" (and the card line "Samat luvut kuin Työkalut-ikkuna antaa tälle rajaukselle")**
Irritates: after Open in Tools the slice line says `Sisätaudit A · ESBL · 2.4. – 30. huhtikuuta 2025` but the result under Run still says `Kaikki yksiköt · 2.4.–12. toukokuuta 2025 · Eristykset 936` with no stale marker; and opening the same signal by link (`#research?inc=…`) gave the slice `Internal medicine A · 2 Apr – 12 May 2025`, not the signal's 2 Apr – 30 Apr, so the card's "same numbers" promise fails.
Fix: grey a result and stamp it `vanha rajaus` as soon as the slice differs from the one it ran on; make the deep-link slice equal the signal's window (2.4.–30.4.).

**S3-3 · Tool inspector (Rate, Compare, … at 1440 px)**
Irritates: the inspector floats over the Signals window and hides the card's top (formula, parameters, Copy LaTeX), so the thing being analysed is covered by its own tool.
Fix: reserve a ~300 px column between the rail and the board (windows reflow right), or dock the inspector in the free column; never overlay a window.

**S3-4 · Rate result, row "Sataa viljelyä kohti"**
Irritates: the label promises a rate per hundred cultures but the value is `110 851 viljelyä` (the denominator); the rate (936/110 851 = 0,84) is missing.
Fix: show `0,84 / 100 viljelyä · 95 %:n luottamusväli …` and move `110 851 viljelyä` to a grey second line.

**S3-5 · Belief vs Compare, same share 7/62**
Irritates: Compare shows `11,3 % 7/62`, interval `5,6 %–21,5 %`; Belief shows `12,5 % 95 %:n väli 5,6 %–21,6 %`; two numbers and two upper limits for one share, no word telling that 12,5 is a posterior mean.
Fix: label Belief's value `keskiarvo (posteriori)` and the observed one `havaittu`; print both in each tool or state the difference once under the number.

**S3-6 · Windows menu → "Toista" (Reproduce)**
Irritates: opens a 1336×768 window that covers the whole board, its content is one sentence and one `Projekti` button; the menu says "Toista" (also the timeline's Play), the window has no title that says Reproduce, the button says Projekti, the toolbar also has Projekti.
Fix: title it `Toista laskut` with the same word in menu and toolbar, open it at ~420×240 beside the Signals window, put the Project actions (Tallenna / Avaa) inside it as two buttons.

**S3-7 · Windows menu → "Avustaja", chart "Lisää kaaviona"**
Irritates: Avustaja opened at y 1084 (below the 900 px fold) and the new chart opened under the inspector; nothing scrolls to them, so the click looks like it did nothing.
Fix: after opening or adding a window scroll it into view and outline it for 1 s; if the board is taller than the viewport, place new windows in the visible area.

**S3-8 · Timeline: button `Tänään · 12.5.2025`, strip `Uutta 2.10.2023 jälkeen · 19`**
Irritates: "Tänään" labels a replay date that is not today (the app's real date is 17.10.2026), and "Uutta … jälkeen" counts 19 months as new; both mislead on what is current.
Fix: `Toiston loppu · 12.5.2025` (or `Aineiston loppu`), and `Signaalit 2.10.2023 – 12.5.2025 · 19` for the strip.

## Severity 2

**S2-1 · Escape with a signal selected**
Irritates: first Escape silently drops the signal (URL loses `inc=`) and the open inspector's frame changes from the signal's slice to `Kaikki yksiköt · 18.2. – 12. toukokuuta 2025`; three Escapes in a row did not close the inspector while focus sat on a Found-so-far card.
Fix: Escape closes the layer on top first (inspector, then card, then selection), and a frame change shows a one-line toast `Rajaus: kaikki yksiköt, 18.2.–12.5.`.

**S2-2 · Sticky timeline**
Irritates: the dock is ≈330 px of 900 (37 %) and stays while the board scrolls under it; with a selected period it grows another line and shifts the controls.
Fix: collapse to the 60 px strip (date, play, band) after the board scrolls, expand on hover/click; reserve the "Valittu" line so nothing shifts.

**S2-3 · Band, after drag-select**
Irritates: the tooltip `Viikko 23.9.2024 – 29.9.2024 …` stays open after the pointer is released and covers the Map and Flow windows.
Fix: close the tooltip on pointerup and on leaving the band.

**S2-4 · Band selection label `Valittu: 22.4. – 29.9. · 23 viikkoa` and its `×`**
Irritates: no year while the date beside it is 12.5.2025 and the range is 2024; the clear `×` looks ≈8 px (not measured).
Fix: `Valittu 22.4.2024 – 29.9.2024 · 23 vk` with a 24 px `Tyhjennä` button.

**S2-5 · Units grid, Signals list under a selected period**
Irritates: with `from=2024-04-22&to=2024-09-29` the Units grid still says `12 viikkoa · 24.2.–18.5.` (ends after the replay date) and the Signals list still shows 2025 entries; the row `vk 20 12.5. *` has an asterisk with no note.
Fix: Units grid and Signals follow the selected period (or say `ei rajattu jaksolla` on the window); explain `*` as `kesken oleva viikko`.

**S2-6 · Windows menu: `Signaalit` and `Signaali`**
Irritates: two entries one letter apart, both ticked in the Analyysi layout (the card exists as a layer and as a window), so closing one does not remove "the card".
Fix: remove `Signaali` from the menu and from layouts; the card lives only as the layer in Signaalit.

**S2-7 · Window names**
Irritates: menu `Avustaja` opens a window titled `Mitä signaalit voivat tarkoittaa` with no input, so "assistant" promises a chat; menu `Yksikköruudukko` opens `ESBL-löydökset viikoittain (lukumäärä)`.
Fix: one name per window, same in menu, title and Close/Focus labels (`Selitys`, `Yksiköt viikoittain`), no `Avustaja` unless it takes a question.

**S2-8 · Method block "Näin se lasketaan" in Finnish**
Irritates: parameter labels `window days`, `baseline days`, `alpha`, `min patients`, `min baseline isolates` and the formula subscript `unit` are English in the Finnish UI.
Fix: `ikkuna (vrk)`, `perustaso (vrk)`, `α`, `vähintään potilaita`, `vähintään perustason isolaatteja`, subscript `yks.`.

**S2-9 · Number formats**
Irritates: `7.3 × 10-4` (dot, no superscript) under "Tällä signaalilla", `7,3 × 10⁻⁴` in the plot caption and `7,3 × 10^−4` in the Detector table; `tavallinen 1,44` next to `1,4` elsewhere.
Fix: one formatter: comma, `×10⁻⁴`, one decimal for expected values everywhere (1,4) or two everywhere.

**S2-10 · Dates**
Irritates: chart axes `04-30`, `10-31`, `04-02` and the sentence `2025-04-30: osastolla …` are ISO fragments in a `d.m.yyyy` UI; English mixes `2 Apr – 30 Apr` with `On 2025-04-30`.
Fix: axes `30.4.`; sentence starts `30.4.2025:`; English `30 Apr 2025`.

**S2-11 · Decision ids `D-020`, `D-041`, `D-076`, `ENGINE.md D1`**
Irritates: shown as sources in the method block, every result footer and Belief (`D-041 vaimennettu`) with no link or meaning for a researcher.
Fix: replace by the method name and a link `Menetelmä →#d-076`, or hide the id behind the ⓘ.

**S2-12 · Compare, field `Tapahtuma`**
Irritates: one list mixes 4 phenotypes and 13 antibiotics, defaults to ESBL which the slice already holds, and "Tapahtuma" does not say it is the tested outcome.
Fix: label `Mitä verrataan`, default to the slice's phenotype, group `Fenotyyppi` / `Antibiootti`.

**S2-13 · Detector inspector and result**
Irritates: `Minkä live-tunnistin merkitsisi tällä jaksolla. Tutkiva: ei koskaan tapahtuma eikä syötteessä.` and `tutkiva: live-kynnykset (D-020), ei korjausta kokeiltujen valintojen määrälle` cannot be read at 3 a.m.
Fix: `Tunnistin hälyttäisi tällä jaksolla. Tulos ei tallennu syötteeseen.` and `Ei monivertailukorjausta: kynnys p < 0,001 (28 vrk vs 365 vrk)`.

**S2-14 · Chart inspector**
Irritates: `Lähde: Siivu kellon ajasta`, `Tulos 2: Määrä jaksolla`, `Osuuden Beta-posteriori`: three names no one can guess.
Fix: `Lähde: nykyinen rajaus / viimeisin tulos (Määrä)`, `Osuus jakson mukaan`, `Osuuden todennäköisyysjakauma (Beta)`.

**S2-15 · Click targets**
Irritates: step chips päivä / viikko / kuukausi and speed chips are 22 px high; window `Keskity` and `Sulje` are 20×20 with 4 px between them (a miss closes the window); resize grip 18×18; `Kerrokset` 20 px; `Mitä viivat tarkoittavat` 24 px; rail buttons 28 px.
Fix: ≥ 28 px high on desktop, 12 px gap between Keskity and Sulje (or move Sulje to the far end), rail 32 px.

**S2-16 · Layers popover vs the list**
Irritates: signal kinds are `Vartijatapaus · Klusteri · Trendi · Dataongelma` in Kerrokset but `Rypäs · Uusi kantaja · Näytekatko` in the list and the strip.
Fix: use the list's names in Kerrokset.

**S2-17 · Band legend line**
Irritates: `Kaistat: resistentit löydökset yksikköä ja viikkoa kohti · merkki on signaali, havaittu · tavallinen` ends in a dangling `tavallinen` whose swatch is not obvious; the meaning of the lanes is in a tooltip behind ⓘ.
Fix: `Korkeus = löydöksiä / yksikkö / viikko · ▲ signaali · ▮ havaittu · ┄ tavallinen` with the real swatches.

**S2-18 · Unit names**
Irritates: Flow window uses codes `ED`, `PHC-N`, `MED-A`, `URO` while Signals, Map and Units use `Päivystys`, `Sisätaudit A`; its title `Potilasvirta · MED-A` pairs with the lead `Yksikön MED-A ympärillä`.
Fix: show full names, code only on hover.

**S2-19 · Card action row `Selitä · Siirry tähän päivään · Näytä kartalla · Menetelmä · Lääkäri · Nähty`**
Irritates: `Selitä`, `Menetelmä` and `Näin se lasketaan` all explain; `Lääkäri` and `Nähty` do not say what they do (navigate away? mark as read?); `Selitä` is a 41×17 text button.
Fix: `Selitä sanoin` once, `Avaa lääkärinäkymässä`, `Merkitse nähdyksi`; make all 28 px buttons.

**S2-20 · Phone, timeline**
Irritates: the timeline is a 54 px strip; date jump, step/speed, Found-so-far and Layers sit behind an unlabelled 36 px chevron (`Open timeline`); the workspace stayed blank ≈1–2 s after reload.
Fix: label the chevron `Aikajana ▾`, show a skeleton in the workspace while loading.

**S2-21 · Phone, tool inspector**
Irritates: the inspector is a static block that pushes Signals down instead of a sheet; the rail is 28 px per icon, the inspector close 24 px, window close 20 px.
Fix: bottom sheet over the board with a 44 px close, rail icons 44 px.

**S2-22 · Phone, Signals window**
Irritates: Signals has its own scrollbar inside a page that is 3105 px tall; a swipe over the list scrolls the list, a swipe elsewhere scrolls the page.
Fix: no inner scroll on the phone; the list grows with the page.

## Severity 1

**S1-1 · Language** is only in Settings (`#settings`), which leaves #research and drops the period/slice in the URL. Fix: `FI/EN` toggle in the header.
**S1-2 · Inspector link `Muuta`** is 39×18 px and does not say it opens Data. Fix: `Muuta rajausta` as a 28 px button.
**S1-3 · Rail buttons** have no `title` (only aria-label and keyshortcut); a tooltip with key was not verified by hover. Fix: `title="Määrä · 1"`.
**S1-4 · Card line `Tavallinen / 1,4 tavallisesti`** (English `Usual / 1.4 usual`) repeats the word. Fix: `Tavallinen / 1,4`.
**S1-5 · `15 lisää listassa`** is a 93×17 text link. Fix: `15 lisää →` as a 28 px button, also shown as count on Signals.
**S1-6 · `Ulottuu · 5`** (Reach): an unusual word for a count of linked units. Fix: `Levinneisyys: 5 yksikköä`.
**S1-7 · Map series dropdown** has 11 near-identical entries (`CPE-kantajuus, E. coli` … `VRE-kantajuus`). Fix: two selects, organism and carriage/blood.
**S1-8 · Step chips' tooltip** `hidas: yksi päivä joka 2. sekunti` is on the *step* chips (it describes speed) and `joka 0.5. sekunti` is not Finnish. Fix: `päivä = 1 päivä / askel`; speed `0,5 s välein`.
**S1-9 · Method block** ends `Ajetaan funktiossa aei.detect.phenotype_excess, aei` (cut off). Fix: `Funktio: aei.detect.phenotype_excess` with a copy button.

## Filler sentences (no number, method, formula, source or action)

1. `Mikä tämä signaali on ja kuinka varmoja olemme` (Signals card lead)
2. `Miltä alue sairaalan Tyks ympärillä näyttää tässä kuussa` (Map lead)
3. `Mistä yksikön Sisätaudit A potilaat tulevat ja minne he siirtyvät` (Flow lead)
4. `Tulkinta signaaleista, ei diagnoosi.` under the label `Pohjateksti` (English `Template`)
5. `Mitä tämä signaali voi tarkoittaa` (heading)
6. `Aja se yllä olevalle rajaukselle. Tulos tulee tähän.` (empty state of every tool)
7. `Jokainen työkalu lukee tämän rajauksen.` (Data inspector)
8. `Miten osuus liikkuu jaksosta toiseen, luottamusväleineen.` and `Mitä aineisto kertoo osuudesta, piirrettynä käyränä.` (Share, Belief)
9. `Vie osoitin tai kohdistus merkin päälle nähdäksesi arvot; napsauta käyttääksesi sitä taulussa.` (every chart; the second clause has no object)
10. Restatements of 7 vs 1,4: `Enemmän ESBL-löydöksiä kuin tällä yksiköllä tavallisesti on, 28 päivässä.`, `2025-04-30: osastolla Sisätaudit A 7 potilaalla todettiin ESBL 28 päivän sisällä, kun odotettu määrä oli noin 1,4.`, `Viimeisin hälytys: Havaittu 7 potilasta · odotettu 1,4 · 28 päivää 30.4.2025 asti` (Selkokielellä): four lines say what the Havaittu/Tavallinen bars already say.
11. `Tutkiva: ei koskaan tapahtuma eikä syötteessä.` (Detector; cryptic, no action)

## What a researcher looks for and cannot find

- Notes: free text pinned to a signal, a slice or a result.
- Two time frames on one page: Compare gives B's numbers but no second band or second chart beside the first.
- A code cell: only `Kopioi Pythonina`; nowhere to edit and run it on the slice.
- A second hospital's timeline (or any comparison with another Tyks site).
- Export of one result with its method: slice, formula, parameters, data fingerprint and decision in one file (Vie CSV header not verified).
- A date-range input (typed from/to); the band drag is the only way to set a period.
- A run history per tool (only the latest result is visible; older ones not found).
- Saved named slices / bookmarks to return to.
- A keyboard cheat sheet (keys V D 1–5 C T are only on the rail).
- A print/PDF view of a card with its numbers and method.

## Ten fixes for one hour, in order

1. S3-3 + S2-1: dock the inspector in its own column; Escape closes the top layer first.
2. S3-2: stamp stale results and make deep-link and "Avaa Työkaluissa" slices equal the signal's window.
3. S3-1 + S3-4: fix the Compare ratio row and the Rate "per 100 cultures" row.
4. S3-7: scroll new windows (Avustaja, charts) into view with a 1 s outline.
5. S3-8: rename `Tänään` and the `Uutta … jälkeen` strip.
6. S3-5: label observed share vs posterior mean in Belief and Compare.
7. S3-6 + S2-6 + S2-7: one name per window; drop `Signaali`; shrink and title the Reproduce window.
8. Filler items 6, 7, 9, 10: delete the empty-state sentences and the third and fourth restatements.
9. S2-8 + S2-9 + S2-10 + S2-11: one number and date formatter; Finnish parameter labels; decision ids behind ⓘ.
10. S2-15 + S2-3 + S2-4: 28 px chips, 12 px gap before Sulje, close the band tooltip on release, show the year in the selection.

## Not exercised

Jump to a date (`Siirry`), Layers toggles beyond opening the popover, Map ⓘ and county pane, Projekti and Vie menus, Kopioi LaTeX / Kopioi / Vie CSV / Vie SVG outputs, Reach chips, Isolates list, Reset (`Palauta rajaus`), double-click on the empty board, Data inspector fields beyond reading them, play/speed runtime, the Found-so-far "more" link target, dark mode, English text of Map, Flow and Units windows.
