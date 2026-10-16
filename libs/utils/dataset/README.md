# @aei/dataset

Loads the organiser's CSV files into typed rows (Node only).

    const data = await loadDataset("data/synthetic_microbiology_dataset");
    const records = joinIsolates(data); // IsolateRecord[]

`parseCsv(text)` is the small RFC 4180 parser underneath. The data
directory is passed in; nothing is hard-coded.

Relies on: D-003, D-004. Tests: `src/csv.test.ts`.
