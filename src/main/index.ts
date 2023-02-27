import RxPlayer from "../core/api";

const videoUrl = "https://www.bok.net/dash/tears_of_steel/cleartext/stream.mpd";
const workerUrl = "./worker.js";
const videoElementRef = document.getElementsByTagName("video")[0];

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
(window as any).RxPlayer = RxPlayer;
const player = new RxPlayer({ videoElement: videoElementRef,
                              workerUrl });
player.loadVideo({
  url: videoUrl,
  transport: "dash",
  autoPlay: true,
});
(window as any).player = player;

export { IContentProtection } from "../core/decrypt";
export {
  IContentInitializationData,
  IMainThreadMessage,
  IWorkerPlaybackObservation,
  IReferenceUpdateMessage,
  IStartContentMessageValue,
} from "./send_message";

