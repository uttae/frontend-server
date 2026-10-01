"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { usePackingList } from "@/hooks/usePackingList";
import { useSheetDrag } from "@/components/mobile/useSheetDrag";
import { BottomSheetDragHandle } from "@/components/mobile/BottomSheetDragHandle";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { normalizePackingMemo, normalizePackingName } from "@/lib/packing/validation";
import type { PackingItem, PackingPart } from "@/lib/packing/types";
import { packingIcons } from "@/lib/public-assets";
import styles from "./PackingPage.module.css";

type Context = ReturnType<typeof usePackingList>;
type Editor = {kind:"createPart"} | {kind:"renamePart"|"createItem"|"renameItem";id:number;name:string};
const actionButton = styles.actionButton;
const linked = (value:string) => renderTextWithLinks(value,{linkClassName:"text-primary underline [overflow-wrap:anywhere]",onLinkClick:event=>event.stopPropagation()});

function PackingIcon({name, size = 24}: {name:keyof typeof packingIcons; size?:number}) {
  const sourceSize = name === "plusWhite" ? 16 : name === "collapse" || name.startsWith("menu") && name !== "menu" ? 20 : 24;
  return <span className={styles.icon} style={{width:size,height:size}} aria-hidden="true">
    <Image src={packingIcons[name]} alt="" width={sourceSize} height={sourceSize} unoptimized
      style={{transform:`scale(${size/sourceSize})`}} />
  </span>;
}

function PackingCheckbox({item,context,detail = false}: {item:PackingItem;context:Context;detail?:boolean}) {
  return <label className={styles.checkbox}>
    <input type="checkbox" aria-label={`${detail ? "상세: " : ""}${item.name} 준비 완료`}
      checked={item.checked} disabled={context.state.status!=="ready"}
      onChange={event=>void context.coordinator?.execute({type:"checkItem",id:item.id,checked:event.target.checked})}/>
    <PackingIcon name={item.checked ? "checkboxChecked" : "checkbox"}/>
  </label>;
}

function NameDialog({editor,context,onClose}: {editor:Editor;context:Context;onClose:()=>void}) {
  const [value,setValue]=useState("name" in editor ? editor.name : "");
  const latestValue=useRef(value);
  const mounted=useRef(true);
  const composing=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const kind=editor.kind.includes("Part") ? "part" : "item";
  const noun=kind==="part" ? "카테고리" : "준비물";
  const title=`${noun} ${editor.kind.startsWith("create") ? "추가" : "이름 수정"}`;
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(saving || composing.current || context.state.status!=="ready" || !context.coordinator) return;
    try {normalizePackingName(value,kind);} catch(error) {setError(error instanceof Error ? error.message : "이름을 확인해 주세요.");return;}
    setSaving(true);
    const command=editor.kind==="createPart" ? {type:"createPart" as const,name:value} : editor.kind==="renamePart" ? {type:"renamePart" as const,id:editor.id,name:value} : editor.kind==="createItem" ? {type:"createItem" as const,partId:editor.id,name:value} : {type:"renameItem" as const,id:editor.id,name:value};
    try {const result=await context.coordinator.execute(command);if(mounted.current && (result.kind==="missing" || (result.kind==="success" && latestValue.current===value))) onClose();} finally {if(mounted.current)setSaving(false);}
  }
  return <SettingsDialog title={title} onClose={onClose} size="compact" className={styles.dialog} overlayClassName={styles.dialogOverlay} showCloseButton={false}><form onSubmit={submit}>
    <label className={styles.fieldLabel}>{noun} 이름<input aria-label={`${noun} 이름`} value={value} onChange={event=>{latestValue.current=event.target.value;setValue(event.target.value);setError("");}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.key==="Enter" && (composing.current || event.nativeEvent.isComposing || event.keyCode===229)) event.preventDefault();}} className={styles.field}/></label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.dialogActions}><button type="button" className={actionButton} onClick={onClose}>취소</button><button type="submit" className={`${actionButton} ${styles.primary}`} disabled={saving || context.state.status!=="ready"} data-waiting={!saving && context.state.status==="writing"}>{editor.kind.startsWith("create") ? "추가" : "저장"}</button></div>
  </form></SettingsDialog>;
}

function DeleteDialog({context,onClose}: {context:Context;onClose:()=>void}) {
  const pending=useRef(false);
  const [deleting,setDeleting]=useState(false);
  const close=useCallback(()=>{if(!pending.current)onClose();},[onClose]);
  const confirmation=context.state.confirmation;
  if(!confirmation) return null;
  const part=confirmation.kind==="part";
  async function confirm(){if(pending.current || context.state.status!=="ready" || !context.coordinator)return;pending.current=true;setDeleting(true);try{await context.coordinator.confirmDelete();}finally{pending.current=false;setDeleting(false);}}
  const count=context.state.data?.parts.find(value=>value.id===confirmation.id)?.items.length ?? 0;
  return <SettingsDialog title={part ? "카테고리를 삭제할까요?" : "준비물을 삭제할까요?"} onClose={close} size="compact" className={styles.dialog} overlayClassName={styles.dialogOverlay} showCloseButton={false}>
    <p className={styles.deleteCopy}>‘{confirmation.name}’{part ? `의 준비물 ${count}개와` : " 준비물과"}<br/>작성한 메모가 함께 삭제됩니다.</p>
    <div className={styles.dialogActions}><button type="button" className={actionButton} disabled={deleting} onClick={close}>취소</button><button type="button" className={`${actionButton} ${styles.danger}`} disabled={deleting || context.state.status!=="ready"} data-waiting={!deleting && context.state.status==="writing"} onClick={()=>void confirm()}>삭제</button></div>
  </SettingsDialog>;
}

function MemoPanel({item,context,open,onComplete}: {item:PackingItem;context:Context;open:boolean;onComplete:()=>void}) {
  const [value,setValue]=useState(item.memo?.content ?? "");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const latestValue=useRef(value);
  const mounted=useRef(true);
  const completionVersion=useRef(0);
  const source=useRef(item.memo?.content ?? "");
  const submitted=useRef<string|null>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!open)completionVersion.current+=1;},[open]);
  useEffect(()=>{const next=item.memo?.content ?? "";if(source.current!==next){const previous=source.current;source.current=next;setValue(current=>current===previous || current===submitted.current ? next : current);}},[item.memo?.content]);
  function cancel() {
    completionVersion.current+=1;
    latestValue.current=item.memo?.content ?? "";
    setValue(latestValue.current);
    setError("");
    onComplete();
  }
  async function save() {
    if(saving || context.state.status!=="ready") return;
    try {normalizePackingMemo(value);} catch(e) {setError(e instanceof Error ? e.message : "메모를 확인해 주세요.");return;}
    setSaving(true);
    submitted.current=value;
    const version=completionVersion.current;
    try {
      const result=await context.coordinator?.execute({type:"saveMemo",id:item.id,content:value});
      if(result?.kind==="success" && mounted.current && version===completionVersion.current && latestValue.current===value) onComplete();
    } finally {
      submitted.current=null;
      if(mounted.current)setSaving(false);
    }
  }
  return <section className={styles.memoPanel} aria-label="내 메모">
    <label htmlFor={`packing-memo-${item.id}`} className={styles.sectionTitle}>내 메모</label>
    <textarea id={`packing-memo-${item.id}`} aria-label="준비물 메모" value={value}
      onChange={event=>{latestValue.current=event.target.value;setValue(event.target.value);setError("");}}
      placeholder="준비물에 대한 메모를 남겨 주세요." maxLength={2000} rows={3} className={styles.memoField}/>
    <div className={styles.memoFooter}>({value.length}/2000)</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={`${styles.dialogActions} ${styles.memoActions}`}>
      <button type="button" className={actionButton} onClick={cancel}>취소</button>
      <button type="button" className={`${actionButton} ${styles.primary}`} disabled={saving || context.state.status!=="ready"} data-waiting={!saving && context.state.status==="writing"} onClick={()=>void save()}>저장</button>
    </div>
  </section>;
}

function Detail({item,context,onClose,onRename,onDelete,open}: {item:PackingItem|null;context:Context;onClose:()=>void;onRename:()=>void;onDelete:()=>void;open:boolean}) {
  const sheetDrag = useSheetDrag(onClose, !open || context.state.status === "writing", "(max-width: 700px)");
  useEffect(()=>{
    if(!open) return;
    function handleEscape(event:KeyboardEvent) {
      if(event.key!=="Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown",handleEscape);
    return()=>document.removeEventListener("keydown",handleEscape);
  },[open,onClose]);
  return <>
    {open && <button type="button" tabIndex={-1} className={styles.detailBackdrop} aria-label="준비물 상세 닫기" onClick={onClose}/>}
    <aside className={styles.detail} style={sheetDrag.surfaceStyle} hidden={!open} data-open={open} aria-label="준비물 상세">
      <BottomSheetDragHandle drag={sheetDrag} className={styles.detailDragHeader}>
        <div className={styles.sheetHandle} aria-hidden="true"/>
        {item && <div className={styles.detailHeader}>
            <PackingCheckbox item={item} context={context} detail/>
            <h2 aria-label="선택한 준비물 이름">{item.name}</h2>
            <div className={styles.detailActions}>
              <button type="button" className={styles.iconButton} aria-label={`준비물 이름 수정: ${item.name}`} onClick={onRename}><PackingIcon name="edit" size={20}/></button>
              <button type="button" className={styles.iconButton} aria-label={`준비물 삭제: ${item.name}`} onClick={onDelete}><PackingIcon name="delete" size={20}/></button>
            </div>
        </div>}
      </BottomSheetDragHandle>
      <div className={styles.detailScroll}>
        {item && <>
          <MemoPanel key={item.id} item={item} context={context} open={open} onComplete={onClose}/>
          {item.tips.length>0 && <section className={styles.tips}>
            <h3 className={styles.sectionTitle}>우때의 여행 팁 <span aria-hidden="true">💡</span></h3>
            <div className={styles.tipCard}>
              <h4>{item.name} 준비 전 확인해 주세요</h4>
              <ul>{item.tips.map((tip,index)=><li key={`${index}:${tip}`}>{linked(tip)}</li>)}</ul>
            </div>
          </section>}
        </>}
      </div>
      <button type="button" className={styles.collapseDetail} aria-label="준비물 상세 접기" onClick={onClose}><PackingIcon name="collapse" size={20}/></button>
    </aside>
  </>;
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
  const loading = !state.data && state.status === "loading";
  const emptyBoard = loading ? <PackingLoadingBoard/> : <output>준비물을 확인할 수 없어요.</output>;
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [menuId,setMenuId]=useState<number|null>(null);
  const [editor,setEditor]=useState<Editor|null>(null);
  const menuTrigger=useRef<HTMLButtonElement|null>(null);
  const parts=[...(state.data?.parts ?? [])].sort((a,b)=>a.column-b.column || a.position-b.position);
  const items=parts.flatMap(part=>part.items);
  const selected=items.find(item=>item.id===selectedId) ?? null;
  const selectedTrigger=useRef<HTMLButtonElement|null>(null);
  const closeDetail=useCallback(()=>{setDetailOpen(false);selectedTrigger.current?.focus({preventScroll:true});},[]);
  function closeMenu(){menuTrigger.current?.focus({preventScroll:true});setMenuId(null);}
  function prepareDelete(kind:"part"|"item",id:number){if(menuId!==null)closeMenu();void coordinator?.prepareDelete(kind,id);}
  useEffect(()=>{if(menuId===null)return;function close(event:PointerEvent){if(!(event.target instanceof Node) || !menuTrigger.current?.parentElement?.contains(event.target))setMenuId(null);}document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[menuId]);
  return <div className={styles.page} aria-busy={loading}>
    <div className={styles.boardPane}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <h1>준비물</h1>
          {state.data && <button type="button" className={styles.addCategory} aria-label="카테고리 추가" onClick={()=>setEditor({kind:"createPart"})}>
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
        {state.message && <div role="alert" className={styles.alert}>
          {state.message}
          {["sync-error","uncertain","error"].includes(state.status) && <button type="button" onClick={()=>void coordinator?.refresh(true)}>다시 확인</button>}
        </div>}
        {!state.data ? emptyBoard : (
          <div className={styles.columns} aria-label="준비물 카테고리">
            {parts.map((part:PackingPart)=><section className={styles.part} key={part.id} aria-label={part.name}>
              <div className={styles.partHeader}>
                <h2>{part.name}</h2>
                <span className={styles.partProgress}>{part.items.filter(item=>item.checked).length}/{part.items.length}</span>
                <button ref={menuId===part.id ? menuTrigger : undefined} type="button" className={styles.menuTrigger}
                  aria-label={`카테고리 메뉴: ${part.name}`} aria-expanded={menuId===part.id} aria-haspopup="menu"
                  onClick={()=>setMenuId(menuId===part.id?null:part.id)}><PackingIcon name="menu" size={20}/></button>
                {menuId===part.id && <div className={styles.menu} role="menu" onKeyDown={event=>{
                  if(event.key==="Escape"){
                    event.preventDefault();event.stopPropagation();closeMenu();
                  }else if(event.key==="ArrowDown"||event.key==="ArrowUp"){
                    event.preventDefault();
                    const choices=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
                    const index=choices.indexOf(document.activeElement as HTMLButtonElement);
                    choices[(index+(event.key==="ArrowDown"?1:choices.length-1))%choices.length]?.focus();
                  }
                }}>
                  <button role="menuitem" type="button" aria-label="준비물 추가" onClick={()=>{closeMenu();setEditor({kind:"createItem",id:part.id,name:""});}}>
                    <PackingIcon name="menuPlus" size={20}/>준비물 추가
                  </button>
                  <button role="menuitem" type="button" aria-label="카테고리 이름 수정" onClick={()=>{closeMenu();setEditor({kind:"renamePart",id:part.id,name:part.name});}}>
                    <PackingIcon name="menuEdit" size={20}/>카테고리 수정
                  </button>
                  <button role="menuitem" type="button" aria-label="카테고리 삭제" className={styles.menuDanger} onClick={()=>prepareDelete("part",part.id)}>
                    <PackingIcon name="menuDelete" size={20}/>카테고리 삭제
                  </button>
                </div>}
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
              <button type="button" className={styles.addItem} onClick={()=>setEditor({kind:"createItem",id:part.id,name:""})} aria-label={`준비물 추가: ${part.name}`}>
                <PackingIcon name="plus" size={16}/>준비물 추가
              </button>
            </section>)}
          </div>
        )}
      </div>
    </div>
    <Detail item={selected} context={context} open={detailOpen && selected!==null} onClose={closeDetail}
      onRename={()=>selected&&setEditor({kind:"renameItem",id:selected.id,name:selected.name})}
      onDelete={()=>selected&&prepareDelete("item",selected.id)}/>
    {editor && <NameDialog key={`${editor.kind}:${"id" in editor?editor.id:"new"}`} editor={editor} context={context} onClose={()=>setEditor(null)}/>}
    {state.confirmation && <DeleteDialog key={`${state.confirmation.kind}:${state.confirmation.id}:${state.confirmation.version}`} context={context} onClose={()=>coordinator?.cancelConfirmation()}/>}
  </div>;
}
export function PackingPage(){const context=usePackingList();return <PackingContent key={`${context.scopeKey}:${context.state.data?.id ?? "loading"}`} context={context}/>;}
