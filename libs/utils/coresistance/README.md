# @aei/coresistance

"Fails together" (D-048): when antibiotic A failed on an isolate here, how
often did antibiotic B fail on the same isolate? Asked for by a doctor the
team consulted: "if it doesn't work for antibiotic A, similar ones likely
won't either". Measured from the hospital's own data; no drug pairs or
classes are hard-coded.

    failsTogether(records, { asOf, ward, specimen, sex?, ageGroup?, onset?, windowDays = 365, minResisted = 30, top = 5 })
    families(antibiotics)          // group a code list ({ code, class }[]) by its class field
    sameFamily(antibiotics, a, b)

For every pair (A, B) of codes found in the data: among first isolates of
the window and specimen (`@aei/counting`, the same pool as the coverage
list) that were **tested for both** and resisted A, the share that also
resisted B, `resistedBoth / resisted`, with a 95 % Wilson interval
(`@aei/coverage` `wilson`). Only results the laboratory reported count:
no inferred or intrinsic values (the data omits intrinsically resistant
pairs). A pair is reported only when `resisted >= 30`, the organiser's
floor. Each pair takes the narrowest level that reaches it, widening as
the coverage list does (D-033, D-047): patient filters are dropped at the
unit in `DROP_ORDER`, then the unit widens to its ward type, then the
hospital. Every link carries its `level` and the `filters` still applied.

`byAntibiotic` lists, per A, its top linked partners by share.

    import { handle, parseQuery, cacheKey } from "@aei/coresistance/route"

The contract of the future route `GET /api/fails-together` (response type
`FailsTogetherResponse`, validation like `/api/coverage`). Not wired yet.

Relies on D-023, D-033, D-047, D-048.
