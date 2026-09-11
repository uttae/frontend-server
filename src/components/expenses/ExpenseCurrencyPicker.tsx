"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { ExpenseCurrency } from "@/lib/api/rooms/expenses";

const currencyNames = new Intl.DisplayNames(["ko"], { type: "currency" });
function currencyName(code: string) {
  return currencyNames.of(code) ?? code;
}

export function ExpenseCurrencyPicker({
  value,
  currencies,
  onChange,
  disabled = false,
}: {
  value: string;
  currencies: ExpenseCurrency[];
  onChange: (currency: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const isOpen = open && !disabled;
  const query = search.trim().toLocaleLowerCase();
  const results = currencies.filter((c) =>
    (c.currency + " " + currencyName(c.currency))
      .toLocaleLowerCase()
      .includes(query),
  );
  const activeIndex = Math.min(active, results.length - 1);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function select(code: string) {
    if (disabled) return;
    onChange(code);
    close();
  }
  useEffect(() => {
    if (!isOpen) return;
    input.current?.focus();
    const element = root.current;
    if (!element) return;
    const outside = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) setOpen(false);
    };
    element.ownerDocument.addEventListener("pointerdown", outside);
    return () =>
      element.ownerDocument.removeEventListener("pointerdown", outside);
  }, [isOpen]);
  useEffect(() => {
    if (isOpen)
      list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen, search]);

  return (
    <div
      ref={root}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span
        id={id + "-label"}
        className="block text-sm font-semibold leading-5"
      >
        통화
      </span>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={
          value ? `통화 선택: ${currencyName(value)} (${value})` : "통화 선택"
        }
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onClick={() => {
          if (disabled) return;
          setSearch("");
          setActive(0);
          setOpen(!isOpen);
        }}
        className="mt-1 flex h-14 w-full min-w-0 items-center gap-2 rounded-xl border border-gray-border bg-white px-3 py-2 text-left text-sm cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-gray-50 aria-expanded:border-primary/50 aria-expanded:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{value || "통화 선택"}</span>
          {value && (
            <span className="block truncate text-xs text-dark-gray">
              {currencyName(value)}
            </span>
          )}
        </span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
      </button>
      {isOpen && (
        <div
          id={id}
          role="dialog"
          aria-label="통화 선택"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-5rem))] max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-gray-border bg-white shadow-xl"
        >
          <div className="p-3">
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3">
              <Search
                size={16}
                className="shrink-0 text-dark-gray"
                aria-hidden="true"
              />
              <input
                ref={input}
                value={search}
                autoComplete="off"
                placeholder="통화 이름 또는 코드 검색"
                aria-label="통화 검색"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls={id + "-list"}
                aria-activedescendant={
                  results[activeIndex]
                    ? id + "-" + results[activeIndex].currency
                    : undefined
                }
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive(
                      Math.max(
                        0,
                        Math.min(
                          results.length - 1,
                          activeIndex + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
                    );
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (results[activeIndex])
                      select(results[activeIndex].currency);
                  }
                }}
                className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none"
              />
            </div>
          </div>
          <div
            ref={list}
            id={id + "-list"}
            role="listbox"
            aria-label="통화 목록"
            className="max-h-52 overflow-y-auto overscroll-contain px-2 pb-2"
          >
            {results.map((c, index) => (
              <button
                key={c.currency}
                id={id + "-" + c.currency}
                type="button"
                role="option"
                aria-selected={c.currency === value}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(c.currency)}
                className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left cursor-pointer transition-colors hover:bg-primary/10 ${index === activeIndex ? "bg-primary/5" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">
                    {currencyName(c.currency)}
                  </span>
                  <span className="block text-xs text-dark-gray">
                    {c.currency}
                  </span>
                </span>
                {c.currency === value && (
                  <Check
                    size={17}
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
          {!results.length && (
            <p role="status" className="px-4 pb-4 text-sm text-dark-gray">
              검색 결과가 없어요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
