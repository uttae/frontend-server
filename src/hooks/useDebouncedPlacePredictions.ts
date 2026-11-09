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

/**
 * Places Autocomplete Data — 디바운스·세션 토큰·in-flight 세대 무시까지 한 경로로 묶음.
 */
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

  // 취소 = 예약한 타이머 취소 + 이미 보낸 요청의 응답 무시(번호 올리기). 취소하는 모든 경로가 이 함수를 거친다
  const cancelPending = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    fetchGenRef.current += 1;
  }, []);

  // 입력 직후 화면이 닫히면 대기 중인 타이머가 Google 자동완성을 한 번 더 보낸다(건별 과금)
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

      // 번호는 예약할 때 잡는다. 그래야 예약 뒤의 취소(다시 입력·닫기·선택)를 모두 알아챈다
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
