"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useForm, useStore } from "@tanstack/react-form";
import { usePackingList } from "@/hooks/usePackingList";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldCount, FieldError, FieldFooter, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMobileView } from "@/contexts/MobileViewContext";
import { SetSectionSideDetailWidth } from "@/contexts/SectionWidthContext";
import { PACKING_DETAIL_WIDTH_PX } from "@/lib/layout-tokens";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { normalizePackingMemo, normalizePackingName } from "@/lib/packing/validation";
import type { PackingItem, PackingPart } from "@/lib/packing/types";
import { packingIcons } from "@/lib/public-assets";
import styles from "./PackingPage.module.css";

type Context = ReturnType<typeof usePackingList>;
type Editor = {kind:"createPart"} | {kind:"renamePart"|"createItem"|"renameItem";id:number;name:string};
const linked = (value:string) => renderTextWithLinks(value,{linkClassName:"text-primary underline [overflow-wrap:anywhere]",onLinkClick:event=>event.stopPropagation()});

// 이름·메모 대화상자나 삭제 확인창이 열려 있으면 Esc는 그쪽 몫이다. Base UI 표면은 <div role="dialog|alertdialog" data-open>이다
const OPEN_DIALOG_SELECTOR = '[role="dialog"][data-open], [role="alertdialog"][data-open]';

function nameError(value:string, kind:"part"|"item") {
  try {
    normalizePackingName(value, kind);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "이름을 확인해 주세요.";
  }
}

function memoError(value:string) {
  try {
    normalizePackingMemo(value);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "메모를 확인해 주세요.";
  }
}

function PackingIcon({name, size = 24}: {name:keyof typeof packingIcons; size?:number}) {
  const sourceSize = name === "plusWhite" ? 16 : name === "collapse" || name.startsWith("menu") && name !== "menu" ? 20 : 24;
  return <span className={styles.icon} style={{width:size,height:size}} aria-hidden="true">
    <Image src={packingIcons[name]} alt="" width={sourceSize} height={sourceSize} unoptimized
      style={{transform:`scale(${size/sourceSize})`}} />
  </span>;
}

function PackingCheckbox({item,context,detail = false}: {item:PackingItem;context:Context;detail?:boolean}) {
  return <label className={styles.checkbox}>
    <Checkbox aria-label={`${detail ? "상세: " : ""}${item.name} 준비 완료`}
      checked={item.checked} disabled={context.state.status!=="ready"}
      onCheckedChange={checked=>void context.coordinator?.execute({type:"checkItem",id:item.id,checked})}/>
  </label>;
}

/**
 * 카테고리·준비물 이름 추가/수정. 열린 채 마운트되고 닫기 요청(Esc·딤·취소)은 onClose다.
 * 다른 항목을 저장하는 동안(status writing)은 제출만 막고 버튼 모양은 그대로 둔다(체크할 때마다 깜빡이지 않게).
 * 동기화 오류처럼 저장할 수 없는 상태(ready·writing 밖)에서는 버튼을 비활성으로 보인다(옛 동작)
 */
function NameDialog({editor,context,finalFocus,onClose}: {editor:Editor;context:Context;finalFocus:()=>HTMLElement|null;onClose:()=>void}) {
  const formId=useId();
  const mounted=useRef(true);
  const composing=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const kind=editor.kind.includes("Part") ? "part" : "item";
  const noun=kind==="part" ? "카테고리" : "준비물";
  const isCreate=editor.kind.startsWith("create");
  const form=useForm({
    defaultValues:{name:"name" in editor ? editor.name : ""},
    onSubmit:async({value,formApi})=>{
      const coordinator=context.coordinator;
      if(!coordinator) return;
      const command=editor.kind==="createPart" ? {type:"createPart" as const,name:value.name} : editor.kind==="renamePart" ? {type:"renamePart" as const,id:editor.id,name:value.name} : editor.kind==="createItem" ? {type:"createItem" as const,partId:editor.id,name:value.name} : {type:"renameItem" as const,id:editor.id,name:value.name};
      const result=await coordinator.execute(command);
      // 저장하는 동안 다시 고친 이름은 남기고, 대화상자를 닫았다 다시 연 뒤 도착한 응답은 새 대화상자를 닫지 않는다
      if(mounted.current && (result.kind==="missing" || (result.kind==="success" && formApi.getFieldValue("name")===value.name))) onClose();
    },
  });
  const isSaving=useStore(form.store,state=>state.isSubmitting);
  const blocked=context.state.status!=="ready" && context.state.status!=="writing";
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}} closeDisabled={isSaving}>
    <DialogContent size="md" showCloseButton={false} finalFocus={finalFocus}>
      <DialogHeader><DialogTitle>{noun} {isCreate ? "추가" : "이름 수정"}</DialogTitle></DialogHeader>
      <form id={formId} noValidate onSubmit={event=>{
        event.preventDefault();
        if(form.state.isSubmitting || composing.current || context.state.status!=="ready" || !context.coordinator) return;
        void form.handleSubmit();
      }}>
        <form.Field name="name" validators={{onSubmit:({value})=>nameError(value,kind)}}>
          {field=>{
            const error=field.state.meta.errors[0];
            return <Field>
              <FieldLabel htmlFor={`${formId}-name`}>{noun} 이름</FieldLabel>
              <Input id={`${formId}-name`} aria-label={`${noun} 이름`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${formId}-name-error` : undefined}
                value={field.state.value} onChange={event=>field.handleChange(event.target.value)} onBlur={field.handleBlur}
                onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
                onKeyDown={event=>{if(event.key==="Enter" && (composing.current || event.nativeEvent.isComposing || event.keyCode===229)) event.preventDefault();}}/>
              <FieldError id={`${formId}-name-error`}>{error}</FieldError>
            </Field>;
          }}
        </form.Field>
      </form>
      <DialogFooter>
        <DialogClose render={<Button variant="weak"/>}>취소</DialogClose>
        <Button type="submit" form={formId} loading={isSaving} loadingLabel={isCreate ? "추가 중" : "저장 중"} disabled={blocked}>{isCreate ? "추가" : "저장"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function DeleteDialog({context,onClose}: {context:Context;onClose:()=>void}) {
  const pending=useRef(false);
  const [deleting,setDeleting]=useState(false);
  const confirmation=context.state.confirmation;
  if(!confirmation) return null;
  const part=confirmation.kind==="part";
  function close(){if(!pending.current)onClose();}
  async function confirm(){if(pending.current || context.state.status!=="ready" || !context.coordinator)return;pending.current=true;setDeleting(true);try{await context.coordinator.confirmDelete();}finally{pending.current=false;setDeleting(false);}}
  const count=context.state.data?.parts.find(value=>value.id===confirmation.id)?.items.length ?? 0;
  return <ConfirmDialog destructive title={part ? "카테고리를 삭제할까요?" : "준비물을 삭제할까요?"}
    description={`‘${confirmation.name}’${part ? `의 준비물 ${count}개와` : " 준비물과"}\n작성한 메모가 함께 삭제됩니다.`}
    confirmLabel="삭제" isPending={deleting} confirmDisabled={context.state.status!=="ready"} onConfirm={()=>void confirm()} onCancel={close}/>;
}

/**
 * 선택한 준비물의 메모 폼. 상세를 닫아도 초안이 남아야 해서(다시 열면 이어 쓰기) 모바일 시트처럼 닫히면 내용이 언마운트되는 껍데기 바깥,
 * 준비물마다 key로 다시 마운트되는 컴포넌트에서 부른다
 */
function useMemoForm(item:PackingItem, context:Context, open:boolean, onComplete:()=>void) {
  const mounted=useRef(true);
  const completionVersion=useRef(0);
  const source=useRef(item.memo?.content ?? "");
  const submitted=useRef<string|null>(null);
  // 열린 동안 서버 메모가 바뀌어도 기본값은 연 순간 값으로 둔다. 칸 값은 아래 effect가 규칙대로 맞춘다
  const [defaultValues]=useState(()=>({memo:item.memo?.content ?? ""}));
  const form=useForm({
    defaultValues,
    onSubmit:async({value,formApi})=>{
      submitted.current=value.memo;
      const version=completionVersion.current;
      try {
        const result=await context.coordinator?.execute({type:"saveMemo",id:item.id,content:value.memo});
        if(result?.kind==="success" && mounted.current && version===completionVersion.current && formApi.getFieldValue("memo")===value.memo) onComplete();
      } finally {
        submitted.current=null;
      }
    },
  });
  const isSaving=useStore(form.store,state=>state.isSubmitting);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!open)completionVersion.current+=1;},[open]);
  // 서버 메모가 바뀌면 손대지 않은 칸(이전 서버 값)이나 방금 보낸 값만 새 값으로 바꾼다. 그 뒤 새로 쓴 초안은 지키지 않는다
  useEffect(()=>{
    const next=item.memo?.content ?? "";
    if(source.current===next) return;
    const previous=source.current;
    source.current=next;
    const current=form.getFieldValue("memo");
    if(current===previous || current===submitted.current) form.setFieldValue("memo",next);
  },[item.memo?.content,form]);
  function cancel() {
    completionVersion.current+=1;
    // 값을 바꾸면 칸을 다시 검사하면서 제출 오류도 지워진다
    form.setFieldValue("memo",item.memo?.content ?? "");
    onComplete();
  }
  function save() {
    if(form.state.isSubmitting || context.state.status!=="ready") return;
    void form.handleSubmit();
  }
  // 저장할 수 없는 상태(동기화 오류 등)면 저장 버튼을 비활성으로 보인다. writing은 제출만 막는다(NameDialog와 같음)
  const blocked=context.state.status!=="ready" && context.state.status!=="writing";
  return {form,isSaving,blocked,cancel,save};
}

function MemoPanel({item,memo}: {item:PackingItem;memo:ReturnType<typeof useMemoForm>}) {
  const {isMobileDevice}=useMobileView();
  const errorId=useId();
  const {form}=memo;
  return <section className={styles.memoPanel} aria-label="내 메모">
    <label htmlFor={`packing-memo-${item.id}`} className={styles.sectionTitle}>내 메모</label>
    <form.Field name="memo" validators={{onSubmit:({value})=>memoError(value)}}>
      {field=>{
        const error=field.state.meta.errors[0];
        return <Field>
          <Textarea id={`packing-memo-${item.id}`} aria-label="준비물 메모" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
            value={field.state.value} onChange={event=>field.handleChange(event.target.value)} onBlur={field.handleBlur}
            placeholder="준비물에 대한 메모를 남겨 주세요." maxLength={2000} rows={3}/>
          <FieldFooter><FieldError id={errorId}>{error}</FieldError><FieldCount>({field.state.value.length}/2000)</FieldCount></FieldFooter>
        </Field>;
      }}
    </form.Field>
    {/* 상세 안 인라인 버튼: PC 패널은 sm, 모바일 기기 시트는 md로 폭을 나눈다 */}
    <div className={styles.memoActions}>
      <Button variant="outline" size={isMobileDevice ? "md" : "sm"} className={isMobileDevice ? "flex-1" : "min-w-18"} onClick={memo.cancel}>취소</Button>
      <Button tone="brand" size={isMobileDevice ? "md" : "sm"} className={isMobileDevice ? "flex-1" : "min-w-18"} loading={memo.isSaving} loadingLabel="저장 중" disabled={memo.blocked} onClick={memo.save}>저장</Button>
    </div>
  </section>;
}

function DetailSections({item,memo}: {item:PackingItem;memo:ReturnType<typeof useMemoForm>}) {
  return <>
    <MemoPanel item={item} memo={memo}/>
    {item.tips.length>0 && <section className={styles.tips}>
      <h3 className={styles.sectionTitle}>우때의 여행 팁 <span aria-hidden="true">💡</span></h3>
      <div className={styles.tipCard}>
        <h4>{item.name} 준비 전 확인해 주세요</h4>
        <ul>{item.tips.map((tip,index)=><li key={`${index}:${tip}`}>{linked(tip)}</li>)}</ul>
      </div>
    </section>}
  </>;
}

/** 체크·이름·수정/삭제 줄. 이름 요소(children)는 PC 패널은 h2, 모바일 시트는 시트 제목(DrawerTitle)이다 */
function DetailHeader({item,context,onRename,onDelete,children}: {item:PackingItem;context:Context;onRename:()=>void;onDelete:()=>void;children:ReactNode}) {
  return <div className={styles.detailHeader}>
    <PackingCheckbox item={item} context={context} detail/>
    {children}
    <div className={styles.detailActions}>
      <button type="button" className={styles.iconButton} aria-label={`준비물 이름 수정: ${item.name}`} onClick={onRename}><PackingIcon name="edit" size={20}/></button>
      <button type="button" className={styles.iconButton} aria-label={`준비물 삭제: ${item.name}`} onClick={onDelete}><PackingIcon name="delete" size={20}/></button>
    </div>
  </div>;
}

type DetailProps = {item:PackingItem|null;context:Context;open:boolean;onClose:()=>void;onRename:()=>void;onDelete:()=>void};
type ItemDetailProps = Omit<DetailProps,"item"> & {item:PackingItem};

/** PC: 목록 오른쪽 비모달 패널. 닫혀도 언마운트하지 않아 메모 초안이 남는다 */
function DetailPanel({item,context,open,onClose,onRename,onDelete}: DetailProps) {
  useEffect(()=>{
    if(!open) return;
    function handleEscape(event:KeyboardEvent) {
      if(event.key!=="Escape" || event.defaultPrevented || document.querySelector(OPEN_DIALOG_SELECTOR)) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown",handleEscape);
    return()=>document.removeEventListener("keydown",handleEscape);
  },[open,onClose]);
  return <aside className={styles.detail} hidden={!open} data-open={open} aria-label="준비물 상세">
    {item && <DetailPanelBody key={item.id} item={item} context={context} open={open} onClose={onClose} onRename={onRename} onDelete={onDelete}/>}
    <button type="button" className={styles.collapseDetail} aria-label="준비물 상세 접기" onClick={onClose}><PackingIcon name="collapse" size={20}/></button>
  </aside>;
}

function DetailPanelBody({item,context,open,onClose,onRename,onDelete}: ItemDetailProps) {
  const memo=useMemoForm(item,context,open,onClose);
  return <>
    <div className={styles.detailTop}>
      <DetailHeader item={item} context={context} onRename={onRename} onDelete={onDelete}>
        <h2 className={styles.detailTitle} aria-label="선택한 준비물 이름">{item.name}</h2>
      </DetailHeader>
    </div>
    <div className={styles.detailScroll}><DetailSections item={item} memo={memo}/></div>
  </>;
}

/**
 * 모바일 기기: 아래 시트(Drawer). 저장 중(status writing)에는 Esc·딤·X·스와이프로 닫히지 않는다.
 * 시트 내용은 닫히면 언마운트되므로 메모 폼은 시트 바깥(DetailSheetBody)이 들고 있다
 */
function DetailSheet({item,context,open,onClose,onRename,onDelete}: DetailProps) {
  return <Drawer open={open} onOpenChange={next=>{if(!next)onClose();}} closeDisabled={context.state.status==="writing"}>
    {item && <DetailSheetBody key={item.id} item={item} context={context} open={open} onClose={onClose} onRename={onRename} onDelete={onDelete}/>}
  </Drawer>;
}

function DetailSheetBody({item,context,open,onClose,onRename,onDelete}: ItemDetailProps) {
  const memo=useMemoForm(item,context,open,onClose);
  // 높이는 지금 시트 값(화면의 76.53%, 위 80px은 남김)
  return <DrawerContent closeLabel="준비물 상세 닫기" className="h-[76.53dvh] max-h-[calc(100dvh-80px)]">
    {/* 오른쪽 닫기 X의 누르는 영역(음수 margin)이 삭제 버튼 영역과 겹치지 않게 띄운다 */}
    <DrawerHeader className="gap-x-3">
      <DetailHeader item={item} context={context} onRename={onRename} onDelete={onDelete}>
        <DrawerTitle className="min-w-0 flex-1">{item.name}</DrawerTitle>
      </DetailHeader>
    </DrawerHeader>
    <DrawerBody className="gap-5"><DetailSections item={item} memo={memo}/></DrawerBody>
  </DrawerContent>;
}

/** 카테고리 메뉴. 항목에서 연 이름 대화상자는 닫힐 때 이 메뉴 버튼으로 포커스를 돌려준다(항목은 메뉴와 함께 사라진다) */
function PartMenu({part,onEdit,onDelete}: {part:PackingPart;onEdit:(editor:Editor,returnFocus:HTMLElement|null)=>void;onDelete:()=>void}) {
  const trigger=useRef<HTMLButtonElement>(null);
  return <DropdownMenu>
    <DropdownMenuTrigger ref={trigger} className={styles.menuTrigger} aria-label={`카테고리 메뉴: ${part.name}`}>
      <PackingIcon name="menu" size={20}/>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={0} className={styles.menuContent}>
      <DropdownMenuItem aria-label="준비물 추가" onClick={()=>onEdit({kind:"createItem",id:part.id,name:""},trigger.current)}>
        <PackingIcon name="menuPlus" size={20}/>준비물 추가
      </DropdownMenuItem>
      <DropdownMenuItem aria-label="카테고리 이름 수정" onClick={()=>onEdit({kind:"renamePart",id:part.id,name:part.name},trigger.current)}>
        <PackingIcon name="menuEdit" size={20}/>카테고리 수정
      </DropdownMenuItem>
      <DropdownMenuItem variant="destructive" aria-label="카테고리 삭제" onClick={onDelete}>
        <PackingIcon name="menuDelete" size={20}/>카테고리 삭제
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function PackingLoadingBoard() {
  return <>
    <output className="block sr-only">준비물을 불러오는 중…</output>
    <div className={styles.columns} aria-hidden="true">
      {Array.from({length:4},(_,column)=><div className={styles.part} key={column}>
        <div className={styles.partHeader}><span className={styles.loadingTitle}/></div>
        <div className={styles.items}>
          {Array.from({length:5},(_,row)=><div className={`${styles.item} ${styles.loadingItem}`} key={row}>
            <span className={styles.loadingCheck}/><span className={styles.loadingLine}/>
          </div>)}
        </div>
        <div className={styles.loadingAdd}/>
      </div>)}
    </div>
  </>;
}

function PackingContent({context}: {context:Context}) {
  const {state,coordinator}=context;
  const {isMobileDevice}=useMobileView();
  const loading = !state.data && state.status === "loading";
  const emptyBoard = loading ? <PackingLoadingBoard/> : <output>준비물을 확인할 수 없어요.</output>;
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [editor,setEditor]=useState<Editor|null>(null);
  // 메뉴 항목에서 연 이름 대화상자의 포커스 복귀 대상. 그 밖에서 열면 null(Base UI 기본: 연 버튼으로 복귀)
  const editorReturnFocus=useRef<HTMLElement|null>(null);
  const parts=[...(state.data?.parts ?? [])].sort((a,b)=>a.column-b.column || a.position-b.position);
  const items=parts.flatMap(part=>part.items);
  const selected=items.find(item=>item.id===selectedId) ?? null;
  const selectedTrigger=useRef<HTMLButtonElement|null>(null);
  const closeDetail=useCallback(()=>{setDetailOpen(false);selectedTrigger.current?.focus({preventScroll:true});},[]);
  function openEditor(next:Editor,returnFocus:HTMLElement|null=null){editorReturnFocus.current=returnFocus;setEditor(next);}
  function prepareDelete(kind:"part"|"item",id:number){void coordinator?.prepareDelete(kind,id);}
  const detailProps:DetailProps={item:selected,context,open:detailOpen && selected!==null,onClose:closeDetail,
    onRename:()=>{if(selected)openEditor({kind:"renameItem",id:selected.id,name:selected.name});},
    onDelete:()=>{if(selected)prepareDelete("item",selected.id);}};
  return <div className={styles.page} aria-busy={loading}>
    {/* 상세가 열리면 목록 400을 지킨 채 상세 폭만큼 데스크톱 최소 폭을 넓힌다 */}
    <SetSectionSideDetailWidth px={detailOpen && selected!==null ? PACKING_DETAIL_WIDTH_PX : 0}/>
    <div className={styles.boardPane}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <h1>준비물</h1>
          {state.data && <button type="button" className={styles.addCategory} aria-label="카테고리 추가" onClick={()=>openEditor({kind:"createPart"})}>
            <PackingIcon name="plusWhite" size={16}/><span>카테고리 추가</span>
          </button>}
          {loading && <span aria-hidden="true" className={`${styles.addCategory} ${styles.loadingAction}`}/>}
          <div className={styles.summary}>
            <p>해외여행 공통 준비물</p>
            {state.data && <p className={styles.progress} aria-label="전체 준비 현황">
              <strong>{items.filter(item=>item.checked).length} / {items.length}</strong><span>개 준비 완료</span>
            </p>}
            {loading && <span aria-hidden="true" className={styles.loadingProgress}/>}
          </div>
        </header>
        {state.message && <div className="pb-4"><Alert tone="warning" orientation="horizontal">
          <AlertTitle>{state.message}</AlertTitle>
          {["sync-error","uncertain","error"].includes(state.status) && <AlertAction><button type="button" className="underline" onClick={()=>void coordinator?.refresh(true)}>다시 확인</button></AlertAction>}
        </Alert></div>}
        {!state.data ? emptyBoard : (
          <div className={styles.columns} aria-label="준비물 카테고리">
            {parts.map((part:PackingPart)=><section className={styles.part} key={part.id} aria-label={part.name}>
              <div className={styles.partHeader}>
                <h2>{part.name}</h2>
                <span className={styles.partProgress}>{part.items.filter(item=>item.checked).length}/{part.items.length}</span>
                <PartMenu part={part} onEdit={openEditor} onDelete={()=>prepareDelete("part",part.id)}/>
              </div>
              <ul className={styles.items}>
                {[...part.items].sort((a,b)=>a.position-b.position).map(item=><li key={item.id} className={styles.item}
                  data-selected={detailOpen && selected?.id===item.id} data-checked={item.checked}>
                  <PackingCheckbox item={item} context={context}/>
                  <button type="button" className={styles.itemSelect} aria-label={`준비물 선택: ${item.name}`}
                    aria-pressed={detailOpen && selected?.id===item.id}
                    onClick={event=>{selectedTrigger.current=event?.currentTarget ?? null;setSelectedId(item.id);setDetailOpen(true);}}>
                    <strong>{item.name}</strong>
                    {item.memo?.content && <small>{item.memo.content}</small>}
                  </button>
                </li>)}
              </ul>
              <button type="button" className={styles.addItem} onClick={()=>openEditor({kind:"createItem",id:part.id,name:""})} aria-label={`준비물 추가: ${part.name}`}>
                <PackingIcon name="plus" size={16}/>준비물 추가
              </button>
            </section>)}
          </div>
        )}
      </div>
    </div>
    {isMobileDevice ? <DetailSheet {...detailProps}/> : <DetailPanel {...detailProps}/>}
    {editor && <NameDialog key={`${editor.kind}:${"id" in editor?editor.id:"new"}`} editor={editor} context={context} finalFocus={()=>editorReturnFocus.current} onClose={()=>setEditor(null)}/>}
    {state.confirmation && <DeleteDialog key={`${state.confirmation.kind}:${state.confirmation.id}:${state.confirmation.version}`} context={context} onClose={()=>coordinator?.cancelConfirmation()}/>}
  </div>;
}
export function PackingPage(){const context=usePackingList();return <PackingContent key={`${context.scopeKey}:${context.state.data?.id ?? "loading"}`} context={context}/>;}
