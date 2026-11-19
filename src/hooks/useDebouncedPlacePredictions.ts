"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS,
  fetchPlacePredictionsForRequest,
  newAutocompleteSessionToken,
} from "@/lib/placesAutocompleteSuggest";

type BuildRequest = (
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
) => google.maps.places.AutocompleteRequest;

export function useDebouncedPlacePredictions(options: {
  placesLibReady: boolean;
  minInputLength: number;
  disabled?: boolean;
  debounceMs?: number;
  buildRequest: BuildRequest;
}) {
  const {
    placesLibReady,
    minInputLength,
    disabled = false,
    debounceMs = AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS,
    buildRequest,
  } = options;

  const [predictions, setPredictions] = useState<
    google.maps.places.PlacePrediction[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const fetchGenRef = useRef(0);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    fetchGenRef.current += 1;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const invalidateSession = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  const clearSuggestionUi = useCallback(() => {
    cancelPending();
    setPredictions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }, [cancelPending]);

  const scheduleFetch = useCallback(
    (value: string) => {
      cancelPending();

      if (!value.trim()) {
        sessionTokenRef.current = null;
      }

      if (
        disabled ||
        !placesLibReady ||
        value.trim().length < minInputLength
      ) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      const gen = fetchGenRef.current;
      debounceRef.current = setTimeout(() => {
        void (async () => {
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = newAutocompleteSessionToken();
          }

          try {
            const request = buildRequest(value, sessionTokenRef.current);
            const list = await fetchPlacePredictionsForRequest(request);
            if (fetchGenRef.current !== gen) return;
            if (list.length > 0) {
              setPredictions(list);
              setIsOpen(true);
              setActiveIndex(-1);
            } else {
              setPredictions([]);
              setIsOpen(false);
            }
          } catch {
            if (fetchGenRef.current !== gen) return;
            setPredictions([]);
            setIsOpen(false);
          }
        })();
      }, debounceMs);
    },
    [buildRequest, cancelPending, debounceMs, disabled, minInputLength, placesLibReady],
  );

  return {
    predictions,
    setPredictions,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    scheduleFetch,
    invalidateSession,
    clearSuggestionUi,
  };
}
