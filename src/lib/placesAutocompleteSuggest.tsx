"use client";

import type { ReactNode } from "react";

export const AUTOCOMPLETE_SUGGEST_DEBOUNCE_MS = 250;

export const DESTINATION_INCLUDED_PRIMARY_TYPES: readonly string[] = [
  "locality",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "country",
  "postal_code",
];

export function circleLocationBias(
  center: google.maps.LatLngLiteral,
  radiusMeters: number,
): google.maps.CircleLiteral {
  return { center, radius: radiusMeters };
}

export function formattableToHighlightedNodes(
  ft: google.maps.places.FormattableText | null | undefined,
  matchClassName: string,
): ReactNode[] {
  if (!ft?.text) return [];
  const text = ft.text;
  const ranges = ft.matches ?? [];
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i += 1) {
    const r = ranges[i];
    const start = r.startOffset;
    const end = r.endOffset;
    if (start > cursor) {
      parts.push(
        <span key={`pre-${i}-${start}`}>{text.slice(cursor, start)}</span>,
      );
    }
    parts.push(
      <span key={`m-${i}-${start}`} className={matchClassName}>
        {text.slice(start, end)}
      </span>,
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }
  return parts;
}

export async function fetchPlacePredictionsForRequest(
  request: google.maps.places.AutocompleteRequest,
): Promise<google.maps.places.PlacePrediction[]> {
  const { suggestions } =
    await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
      request,
    );
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is google.maps.places.PlacePrediction => p != null);
}

export function newAutocompleteSessionToken(): google.maps.places.AutocompleteSessionToken {
  return new google.maps.places.AutocompleteSessionToken();
}

export function PlacePredictionInlineDescription({
  prediction,
  matchClassName,
  primaryTextClassName,
  secondaryTextClassName,
}: {
  prediction: google.maps.places.PlacePrediction;
  matchClassName: string;
  primaryTextClassName: string;
  secondaryTextClassName: string;
}) {
  const main = prediction.mainText ?? prediction.text;
  const mainParts = formattableToHighlightedNodes(main, matchClassName);
  const secondaryText = prediction.secondaryText?.text?.trim() ?? "";

  return (
    <>
      <span className={primaryTextClassName}>{mainParts}</span>
      {secondaryText ? (
        <span className={secondaryTextClassName}>{secondaryText}</span>
      ) : null}
    </>
  );
}
