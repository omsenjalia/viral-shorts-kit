import { AbsoluteFill, Composition, Img, Still } from "remotion";
import { BRAND } from "../brand-template/brand";
import { Banner } from "../brand-template/Banner";
import { Mascot } from "../brand-template/Mascot";
import { Episode, EpisodeProps, calculateEpisodeMetadata } from "./Episode";
import { Thumbnail } from "./Thumbnail";
import { ShotLab, ShotLabWide, shotLabDefault, shotLabMetadata } from "./ShotLab";

const defaultProps: EpisodeProps = { slug: "hyperframes-open-source" };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Short"
        component={Episode}
        width={1080}
        height={1920}
        fps={BRAND.fps}
        durationInFrames={1}
        defaultProps={defaultProps}
        calculateMetadata={calculateEpisodeMetadata}
      />
      <Composition
        id="Long"
        component={Episode}
        width={1920}
        height={1080}
        fps={BRAND.fps}
        durationInFrames={1}
        defaultProps={defaultProps}
        calculateMetadata={calculateEpisodeMetadata}
      />
      {/* Preview a single scene/shot (no voice): see src/ShotLab.tsx */}
      <Composition id="ShotLab" component={ShotLab} width={1080} height={1920} fps={BRAND.fps} durationInFrames={90} defaultProps={shotLabDefault} calculateMetadata={shotLabMetadata} />
      <Composition id="ShotLabWide" component={ShotLabWide} width={1920} height={1080} fps={BRAND.fps} durationInFrames={90} defaultProps={shotLabDefault} calculateMetadata={shotLabMetadata} />
      {/* Custom thumbnail from the episode's hook: 1280x720 */}
      <Still
        id="Thumbnail"
        component={Thumbnail}
        width={1280}
        height={720}
        defaultProps={defaultProps}
        calculateMetadata={async (a) => ({ props: (await calculateEpisodeMetadata(a)).props })}
      />
      {/* YouTube channel icon: 800x800 PNG */}
      <Still
        id="ChannelIcon"
        width={800}
        height={800}
        component={() => <Img src={BRAND.logo} style={{ width: "100%", height: "100%" }} />}
      />
      {/* YouTube channel banner: 2560x1440 */}
      <Still id="ChannelBanner" width={2560} height={1440} component={Banner} />
      {/* Transparent mascot PNG for thumbnails */}
      <Still
        id="MascotPNG"
        width={1000}
        height={1200}
        component={() => (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            {/* negative delay: a Still only has frame 0, so skip the pop-in */}
            <Mascot size={800} enterDelay={-60} />
          </AbsoluteFill>
        )}
      />
    </>
  );
};
