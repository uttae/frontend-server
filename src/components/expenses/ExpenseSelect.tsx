"use client";

import { useId, useState } from "react";

import { ChevronDownIcon } from "@/assets/icons";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMobileView } from "@/contexts/MobileViewContext";
import { cn } from "@/lib/utils";

type ExpenseSelectOption = { value: string; label: string };

/**
 * 가계부 선택 칸. 빈 문자열 값은 '선택 없음'이다(카테고리 미선택, 장소 연결 없음).
 * 목록은 ui Select이고, mobileSheet이면 모바일 기기에서만 아래 시트 라디오 목록(Drawer)으로 고른다.
 */
export function ExpenseSelect({
  label,
  name,
  value,
  options,
  onChange,
  placeholder = "선택",
  disabled = false,
  mobileSheet = false,
  compact = false,
  id,
  "aria-invalid": ariaInvalid,
}: {
  label: string;
  name?: string;
  value: string;
  options: ExpenseSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** 모바일 기기에서 아래 시트 라디오 목록으로 고른다(가계부 카테고리 필터) */
  mobileSheet?: boolean;
  /** 시트 트리거만 작게 그린다. ui Select 트리거는 디자인 시스템 크기 하나다 */
  compact?: boolean;
  /** 보이는 라벨(FieldLabel htmlFor)과 잇는 트리거 id */
  id?: string;
  /** 칸 오류. 트리거에 Text Field 오류 모양을 그린다 */
  "aria-invalid"?: boolean;
}) {
  const { isMobileDevice } = useMobileView();
  if (mobileSheet && isMobileDevice) {
    return (
      <ExpenseSelectSheet
        label={label}
        name={name}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        compact={compact}
      />
    );
  }
  // Base UI Select는 null만 '선택 없음'으로 본다. 빈 문자열을 그대로 넘기면 '장소 연결 없음' 같은 빈 값 항목의 라벨 대신 placeholder가 보인다
  const items = options.map((option) => ({ value: option.value === "" ? null : option.value, label: option.label }));
  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(next) => onChange(next ?? "")}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} aria-invalid={ariaInvalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? ""} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// 모바일 기기 카테고리 시트. 트리거는 지금 시트 트리거 모양 그대로, 목록은 Drawer + 라디오다
function ExpenseSelectSheet({
  label,
  name,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  compact,
}: Readonly<{
  label: string;
  name?: string;
  value: string;
  options: ExpenseSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  compact: boolean;
}>) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const sheetId = useId();
  const isOpen = isSheetOpen && !disabled;
  const selected = options.find((option) => option.value === value);
  return (
    <Drawer open={isOpen} onOpenChange={setIsSheetOpen}>
      <button
        type="button"
        name={name}
        role="combobox"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? sheetId : undefined}
        disabled={disabled}
        onClick={() => setIsSheetOpen(true)}
        className={cn("flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-fill-subtle px-3.5 py-2 text-left text-[16px] leading-6 font-normal cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-gray-50 aria-expanded:border-primary/50 aria-expanded:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50", compact && "min-h-10 gap-2 px-3 text-[14px] leading-5 mobile:min-h-11 max-sm:min-h-11")}
      >
        <span className={cn("min-w-0 break-words", !selected && "text-text-subtle")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon
          size={compact ? 16 : 20}
          aria-hidden="true"
          className={cn("shrink-0 text-icon-subtle transition-transform", isOpen && "rotate-180")}
        />
      </button>
      <DrawerContent id={sheetId} closeLabel="카테고리 닫기">
        <DrawerHeader>
          <DrawerTitle>카테고리</DrawerTitle>
          <DrawerDescription>선택한 카테고리를 보여줘요.</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <RadioGroup
            aria-label={label}
            value={value}
            onValueChange={(next) => {
              onChange(String(next));
              setIsSheetOpen(false);
            }}
          >
            {options.map((option) => (
              <label
                key={option.value}
                className={cn("flex min-h-12 cursor-pointer items-center justify-between text-body-s-emphasis", compact && "text-[14px] leading-5")}
              >
                {option.value === "ALL" ? "전체" : option.label}
                <RadioGroupItem value={option.value} />
              </label>
            ))}
          </RadioGroup>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
