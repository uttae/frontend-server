"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Field } from "@/components/ui/field";
import type { ExpenseCurrency } from "@/lib/api/rooms/expenses";

const currencyNames = new Intl.DisplayNames(["ko"], { type: "currency" });
function currencyName(code: string) {
  return currencyNames.of(code) ?? code;
}
function matchCurrency(item: ExpenseCurrency, query: string) {
  return `${item.currency} ${currencyName(item.currency)}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
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
  const selected =
    currencies.find((currency) => currency.currency === value) ??
    (value ? { currency: value, fractionDigits: 0, maximumAmount: "0" } : null);
  return (
    <Combobox
      items={currencies}
      value={selected}
      onValueChange={(next) => {
        if (next) onChange(next.currency);
      }}
      itemToStringLabel={(currency: ExpenseCurrency) => currencyName(currency.currency)}
      isItemEqualToValue={(a, b) => a.currency === b.currency}
      filter={matchCurrency}
      autoHighlight
      disabled={disabled}
    >
      <Field>
        <ComboboxLabel>통화</ComboboxLabel>
        <ComboboxTrigger>
          <ComboboxValue>
            {(currency: ExpenseCurrency | null) =>
              currency ? (
                <>
                  <span className="block truncate">{currency.currency}</span>
                  <span className="block truncate text-caption-m-regular text-text-subtle mobile:hidden">
                    {currencyName(currency.currency)}
                  </span>
                </>
              ) : (
                "통화 선택"
              )
            }
          </ComboboxValue>
        </ComboboxTrigger>
      </Field>
      <ComboboxContent aria-label="통화 선택" className="w-[min(20rem,calc(100vw-5rem))]">
        <ComboboxInput placeholder="통화 이름 또는 코드 검색" aria-label="통화 검색" />
        <ComboboxList>
          {(currency: ExpenseCurrency) => (
            <ComboboxItem key={currency.currency} value={currency} description={currency.currency}>
              {currencyName(currency.currency)}
            </ComboboxItem>
          )}
        </ComboboxList>
        <ComboboxEmpty>검색 결과가 없어요.</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  );
}
