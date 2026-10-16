import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Close } from "./scenes/Close";
import { Feed } from "./scenes/Feed";
import { Intro } from "./scenes/Intro";
import { Outbreak } from "./scenes/Outbreak";
import { Region } from "./scenes/Region";
import { Treat } from "./scenes/Treat";
import { C } from "./theme";

const bg = { backgroundColor: C.bg };

// 5 + 12 + 10 + 15 + 13 + 10 s at 30 fps, less five 15-frame crossfades: 1875 frames, 62.5 s.
export const PITCH_FRAMES = 1875;

export const Pitch = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Intro" durationInFrames={150}>
      <Intro style={bg} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Lab feed" durationInFrames={360}>
      <Feed style={bg} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Outbreak" durationInFrames={300}>
      <Outbreak style={bg} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="What works" durationInFrames={450}>
      <Treat style={bg} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Region" durationInFrames={390}>
      <Region style={bg} />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
    <TransitionSeries.Sequence name="Close" durationInFrames={300}>
      <Close style={bg} />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
