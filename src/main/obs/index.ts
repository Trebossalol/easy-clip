/**
 * OBS process + WebSocket session.
 *
 * `clip-mode` launches OBS with replay buffer / tray flags.
 * `connection` owns the WebSocket, reconnect backoff, and status events.
 * Starting OBS is separate from `config.AUTOSTART` Windows logon (see autostart.ts).
 */
export { startObsClipMode, startObsProcessPoll, stopObsProcessPoll } from "./clip-mode.js";
export {
  connectObs,
  disconnectObs,
  beginIntentionalDisconnect,
  disconnectObsSocketBestEffort,
  waitForObsConnected,
} from "./connection.js";
export {
  isObsProcessRunning,
  refreshObsProcessRunning,
} from "./process.js";
export {
  applyConfiguredReplayMaxSeconds,
  ensureReplayBufferStarted,
  refreshReplayMaxSeconds,
} from "./replay.js";
export { applyClipScene, fetchObsScenes, prepareObsClipScene } from "./scenes.js";
export { getObsSocket, obsState } from "./state.js";
export { currentObsStatus, refreshRecordDirectory, sendObsStatus } from "./status.js";
export { stopObsClipMode } from "./stop.js";
