import { Composition, Folder } from "remotion";
import { PITCH_FRAMES, Pitch } from "./Pitch";
import { Close } from "./scenes/Close";
import { Feed } from "./scenes/Feed";
import { Intro } from "./scenes/Intro";
import { Outbreak } from "./scenes/Outbreak";
import { Region } from "./scenes/Region";
import { Treat } from "./scenes/Treat";

export const RemotionRoot = () => (
  <>
    <Composition id="Pitch" component={Pitch} durationInFrames={PITCH_FRAMES} fps={30} width={1920} height={1080} />
    <Folder name="Scenes">
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
      <Composition
        id="Feed"
        component={Feed}
        durationInFrames={360}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
      <Composition
        id="Outbreak"
        component={Outbreak}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
      <Composition
        id="Treat"
        component={Treat}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
      <Composition
        id="Region"
        component={Region}
        durationInFrames={390}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
      <Composition
        id="Close"
        component={Close}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#f3f6f9" } }}
      />
    </Folder>
  </>
);
