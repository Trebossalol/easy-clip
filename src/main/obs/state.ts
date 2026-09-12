import { OBSWebSocket } from "obs-websocket-js";

/** Mutable OBS connection + process session for this Electron process. */
export const obsState = {
  socket: new OBSWebSocket(),
  connected: false,
  error: undefined as string | undefined,
  replayBufferActive: null as boolean | null,
  replayMaxSeconds: null as number | null,
  currentProgramScene: null as string | null,
  recordDirectory: null as string | null,
  reconnectTimer: null as NodeJS.Timeout | null,
  reconnectAttempt: 0,
  intentionalDisconnect: false,
  processRunning: false,
  processPoll: null as NodeJS.Timeout | null,
  connectGen: 0,
  connecting: false,
};

export function getObsSocket(): OBSWebSocket {
  return obsState.socket;
}
