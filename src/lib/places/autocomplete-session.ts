import { autocompletePlaces, issuePlaceSession, type PlaceSession } from "@/lib/api/place-sessions";

export const MAP_AUTOCOMPLETE_DEBOUNCE_MS = 250;
/** One input flow: lazy issuance, serialized autocomplete and explicit abandonment. */
export class AutocompleteSearchSession {
  private controller = new AbortController();
  private issued: Promise<PlaceSession> | null = null;
  private session: PlaceSession | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  abandon() { this.controller.abort(); }
  async suggest(input: string, center: google.maps.LatLngLiteral, isCurrent: () => boolean) {
    const signal = this.controller.signal;
    if (this.session && this.session.expiresAt <= Date.now()) {
      this.session = null; this.issued = null;
    }
    this.issued ??= issuePlaceSession(signal).then(session => { this.session = session; return session; });
    const issued = this.issued;
    const work = this.queue.catch(() => {}).then(async () => {
      const session = await issued;
      if (signal.aborted || !isCurrent()) return null;
      const result = await autocompletePlaces({ sessionToken: session.sessionToken, input,
        latitude: center.lat, longitude: center.lng }, signal);
      if (signal.aborted || !isCurrent() || session.expiresAt <= Date.now()) return null;
      return { session, items: result.suggestions.map(s => s.placePrediction) };
    });
    this.queue = work;
    return work;
  }
}
