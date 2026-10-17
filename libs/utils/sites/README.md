# @aei/sites

The hospitals connected to one AEI server (D-051). The home site, `tyks`,
is the dataset's hospital and is defined in code (`HOME_SITE` in
@aei/domain); it is the only site when no sites file is given. Other sites
come from the file `AEI_SITES` names.

    parseSitesFile(json)              // -> SitesFile; throws SitesFileError listing every problem
    buildRegistry(file, options)      // -> SiteRegistry: sites, wards, siteOfWard, byToken, connection
    authorize(registry, header)       // Authorization: Bearer <token> -> the sending site, or 401
    qualifyResult(result, site)       // a site's rows with units as "<siteId>/<code>"; unregistered units listed
    qualifyWard(siteId, code)         // "ICU" from sata -> "sata/ICU"; home codes stay bare
    loadSites(path)                   // @aei/sites/node: read the file and each site's code map

The main entry runs in a browser too (the web's message checker uses it);
`@aei/sites/node` reads files.

## The file

```json
{
  "sites": [
    {
      "id": "sata",
      "fi": "Satasairaala",
      "en": "Satasairaala",
      "county": "Satakunnan hyvinvointialue",
      "token": "a long random string",
      "wards": [{ "code": "ICU", "fi": "Teho-osasto", "en": "Intensive care unit", "type": "in", "institution": "hospital" }],
      "codeMap": "sata-codes.json",
      "guideline": "EUCAST 2025"
    },
    { "id": "tyks", "token": "another long random string" }
  ]
}
```

`county` is a region name of the regional data (`COUNTIES`). `codeMap` is a
@aei/ingest `CodeMaps` file, relative to the sites file, merged over the THL
defaults for that site only. A connected site's ward map holds only its own
units (by code and by name); a location it did not register is kept as sent,
qualified, with a warning. Listing the home site gives it a token; then
requests without one are refused.

Tokens are plain shared secrets kept in a mode-600 file: pilot packaging,
not hardened authentication (deploy/README.md).

## Rules every gear follows

Statistics stay within a site: a unit is compared with the rest of its own
hospital, never with the pool of all sites. A unit's site is
`siteOfWard(code)` (@aei/domain), which needs no registry: a qualified code
names its site, a bare code is the home site's. Patient flow and carrier
trails (@aei/relations) stay global, so a patient sampled at `URO` and then
at `sata/ICU` is a move between hospitals.
