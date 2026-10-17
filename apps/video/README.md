# apps/video

The pitch film (about 62 s, 1920×1080), made with Remotion as React code.
Every number on screen comes from the running AEI server, read into
`src/snapshot.json` by `scripts/snapshot.mjs`, or from the experiment
records (the closing card cites each experiment).

    pnpm --filter @aei/video dev          # Remotion Studio: preview and scrub
    AEI_URL=http://localhost:8787 pnpm --filter @aei/video snapshot   # refresh the numbers
    pnpm --filter @aei/video render Pitch out/pitch.mp4               # render (several CPU minutes)

The snapshot needs the server with the full dataset and the THL file
(`uv run python scripts/fetch_thl_ttr.py`), and the county outlines
(`uv run python scripts/fetch_county_geometry.py`). Scenes: Intro, Feed (a
real HL7 message, then every result landing on its unit), Outbreak (the
Urology alert of 4 June 2025), Treat (mild then severe coverage, with the
all-organism share), Region (THL county signals on a map), Close (data
checks and evidence). Remotion is free for teams of up to three; larger
companies need a licence. Sources: THL and Statistics Finland, CC BY 4.0.
