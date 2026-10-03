export const PROTOCOL_VERSION = 1 as const;
export interface Envelope<T> {
  version: typeof PROTOCOL_VERSION;
  requestId: string;
  payload: T;
}
