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
// 검색어 앞뒤 공백은 무시하고, 통화 코드·한국어 이름에 포함되면 찾는다(대소문자 무시). Base UI 기본 필터는 공백을 다듬지 않는다
function matchCurrency(item: ExpenseCurrency, query: string) {
  return `${item.currency} ${currencyName(item.currency)}`
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}

/** 통화 선택. 트리거를 누르면 팝업 안 검색 입력과 서버 통화 목록이 열린다(목록 밖 통화는 고를 수 없다) */
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
  // 통화 목록이 아직 없거나(조회 중·실패) 비용의 통화가 목록에 없어도 트리거에는 폼 값을 보인다(옛 동작).
  // 대체 항목은 목록에 없어 고르거나 체크되지 않고, 트리거 글자와 같은 값 비교(통화 코드)에만 쓰인다
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
      // 검색어를 입력하면 첫 결과를 강조해 Enter로 바로 고른다(옛 동작: 검색어가 바뀔 때마다 첫 결과가 활성)
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
                  {/* 좁은 칸(모바일 기기·좁은 화면)에서는 코드만 보인다. 비용 편집 폼이 이 조건에서 통화 칸을 줄인다 */}
                  <span className="block truncate text-caption-m-regular text-text-subtle mobile:hidden max-sm:hidden">
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
