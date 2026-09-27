"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, Ellipsis, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { usePackingList } from "@/hooks/usePackingList";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { normalizePackingMemo, normalizePackingName } from "@/lib/packing/validation";
import type { PackingItem, PackingPart } from "@/lib/packing/types";
import styles from "./PackingPage.module.css";

type Context = ReturnType<typeof usePackingList>;
type Editor = {kind:"createPart"} | {kind:"renamePart"|"createItem"|"renameItem";id:number;name:string};
const iconButton = "inline-flex h-10 w-10 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary";
const actionButton = "min-h-10 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const linked = (value:string) => renderTextWithLinks(value,{linkClassName:"text-primary underline [overflow-wrap:anywhere]",onLinkClick:event=>event.stopPropagation()});

function NameDialog({editor,context,onClose}: {editor:Editor;context:Context;onClose:()=>void}) {
  const [value,setValue]=useState("name" in editor ? editor.name : "");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);
  const kind=editor.kind.includes("Part") ? "part" : "item";
  const noun=kind==="part" ? "카테고리" : "준비물";
  const title=`${noun} ${editor.kind.startsWith("create") ? "추가" : "이름 수정"}`;
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(saving || context.state.status!=="ready" || !context.coordinator) return;
    try {normalizePackingName(value,kind);} catch(error) {setError(error instanceof Error ? error.message : "이름을 확인해 주세요.");return;}
    setSaving(true);
    const command=editor.kind==="createPart" ? {type:"createPart" as const,name:value} : editor.kind==="renamePart" ? {type:"renamePart" as const,id:editor.id,name:value} : editor.kind==="createItem" ? {type:"createItem" as const,partId:editor.id,name:value} : {type:"renameItem" as const,id:editor.id,name:value};
    try {const result=await context.coordinator.execute(command);if(result.kind==="success") onClose();} finally {setSaving(false);}
  }
  return <SettingsDialog title={title} onClose={onClose} size="compact"><form onSubmit={submit}>
    <label className={styles.fieldLabel}>{noun} 이름<input aria-label={`${noun} 이름`} value={value} onChange={event=>{setValue(event.target.value);setError("");}} onKeyDown={event=>{if(event.key==="Enter" && event.nativeEvent.isComposing) event.preventDefault();}} className={styles.field}/></label>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.dialogActions}><button type="button" className={actionButton} onClick={onClose}>취소</button><button type="submit" className={`${actionButton} ${styles.primary}`} disabled={saving || context.state.status!=="ready"}>{editor.kind.startsWith("create") ? "추가" : "저장"}</button></div>
  </form></SettingsDialog>;
}

function DeleteDialog({context,onClose}: {context:Context;onClose:()=>void}) {
  const confirmation=context.state.confirmation;
  if(!confirmation) return null;
  const part=confirmation.kind==="part";
  return <SettingsDialog title={`${part ? "카테고리" : "준비물"} 삭제`} onClose={onClose} size="compact">
    <p className={styles.deleteCopy}>‘{confirmation.name}’{part ? " 카테고리와 포함된 준비물을" : " 준비물을"} 삭제할까요? 삭제한 내용은 복구할 수 없어요.</p>
    <div className={styles.dialogActions}><button type="button" className={actionButton} onClick={onClose}>취소</button><button type="button" className={`${actionButton} ${styles.danger}`} disabled={context.state.status!=="ready"} onClick={()=>void context.coordinator?.confirmDelete()}>삭제</button></div>
  </SettingsDialog>;
}

function MemoPanel({item,context}: {item:PackingItem;context:Context}) {
  const [value,setValue]=useState(item.memo?.content ?? "");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const source=useRef(item.memo?.content ?? "");
  useEffect(()=>{const next=item.memo?.content ?? "";if(source.current!==next){source.current=next;setValue(next);}},[item.memo?.content]);
  async function save() {
    if(saving || context.state.status!=="ready") return;
    try {normalizePackingMemo(value);} catch(e) {setError(e instanceof Error ? e.message : "메모를 확인해 주세요.");return;}
    setSaving(true);
    try {const result=await context.coordinator?.execute({type:"saveMemo",id:item.id,content:value});if(result?.kind==="success") source.current=value;} finally {setSaving(false);}
  }
  async function remove() {if(saving || context.state.status!=="ready")return;setSaving(true);try{await context.coordinator?.execute({type:"deleteMemo",id:item.id});}finally{setSaving(false);}}
  return <section className={styles.memoPanel} aria-label="내용 메모"><label htmlFor={`packing-memo-${item.id}`} className={styles.sectionTitle}>내용 메모</label><textarea id={`packing-memo-${item.id}`} aria-label="준비물 메모" value={value} onChange={event=>{setValue(event.target.value);setError("");}} placeholder="여권 사본은 휴대폰에도 저장해 두었어요." maxLength={2000} rows={5} className={styles.memoField}/><div className={styles.memoFooter}><span>{value.length}/2000</span>{item.memo && <button type="button" aria-label={`메모 삭제: ${item.name}`} className={iconButton} disabled={saving} onClick={()=>void remove()}><Trash2 size={16}/></button>}</div>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.dialogActions}><button type="button" className={actionButton} onClick={()=>setValue(item.memo?.content ?? "")}>취소</button><button type="button" className={`${actionButton} ${styles.primary}`} disabled={saving || context.state.status!=="ready"} onClick={()=>void save()}>저장</button></div></section>;
}

function Detail({item,context,onClose,onRename,onDelete,open}: {item:PackingItem|null;context:Context;onClose:()=>void;onRename:()=>void;onDelete:()=>void;open:boolean}) {
  return <aside className={styles.detail} data-open={open} aria-label="준비물 상세">
    {item ? <><div className={styles.detailHeader}><button type="button" className={`${iconButton} ${styles.mobileBack}`} aria-label="준비물 목록으로" onClick={onClose}><ChevronLeft size={20}/></button><h2 aria-label="선택한 준비물 이름">{item.name}</h2><div className={styles.detailActions}><button type="button" className={iconButton} aria-label={`준비물 이름 수정: ${item.name}`} onClick={onRename}><Pencil size={17}/></button><button type="button" className={iconButton} aria-label={`준비물 삭제: ${item.name}`} onClick={onDelete}><Trash2 size={17}/></button></div></div><MemoPanel key={item.id} item={item} context={context}/>{item.tips.length>0 && <section className={styles.tips}><h3 className={styles.sectionTitle}>여행에 유용한 팁 <Lightbulb size={15} aria-hidden="true"/></h3><ul>{item.tips.map((tip,index)=><li key={`${index}:${tip}`}>{linked(tip)}</li>)}</ul></section>}</> : <p className={styles.detailEmpty}>준비물을 선택하면 내용을 볼 수 있어요.</p>}
  </aside>;
}

function PackingContent({context}: {context:Context}) {
  const {state,coordinator}=context;
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [menuId,setMenuId]=useState<number|null>(null);
  const [editor,setEditor]=useState<Editor|null>(null);
  const menuTrigger=useRef<HTMLButtonElement|null>(null);
  const ready=state.status==="ready";
  const parts=[...(state.data?.parts ?? [])].sort((a,b)=>a.column-b.column || a.position-b.position);
  const items=parts.flatMap(part=>part.items);
  const selected=items.find(item=>item.id===selectedId) ?? items[0] ?? null;
  function closeMenu(){menuTrigger.current?.focus({preventScroll:true});setMenuId(null);}
  function prepareDelete(kind:"part"|"item",id:number){if(menuId!==null)closeMenu();void coordinator?.prepareDelete(kind,id);}
  useEffect(()=>{if(menuId===null)return;function close(event:PointerEvent){if(!(event.target instanceof Node) || !menuTrigger.current?.parentElement?.contains(event.target))setMenuId(null);}document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);},[menuId]);
  return <div className={styles.page}>
    <div className={styles.boardPane}><div className={styles.content}>
      <header className={styles.pageHeader}><div><h1>준비물</h1><p>해외여행 공통 준비물</p>{state.data && <p className={styles.progress} aria-label="전체 준비 현황">{items.filter(item=>item.checked).length} / {items.length}개 준비 완료</p>}</div>{state.data && <button type="button" className={styles.addCategory} aria-label="카테고리 추가" onClick={()=>setEditor({kind:"createPart"})}><Plus size={16} aria-hidden="true"/> 카테고리 추가</button>}</header>
      {state.message && <div role="alert" className={styles.alert}>{state.message}{["sync-error","uncertain","error"].includes(state.status)&&<button type="button" onClick={()=>void coordinator?.refresh(true)}>다시 확인</button>}</div>}
      {!state.data ? <p role="status">{state.status==="loading" ? "준비물을 불러오는 중…" : "준비물을 확인할 수 없어요."}</p> : <div className={styles.columns} aria-label="준비물 카테고리">
        {parts.map((part:PackingPart)=><section className={styles.part} key={part.id} aria-label={part.name}><div className={styles.partHeader}><h2>{part.name}</h2><button ref={menuId===part.id ? menuTrigger : undefined} type="button" className={iconButton} aria-label={`카테고리 메뉴: ${part.name}`} aria-expanded={menuId===part.id} onClick={()=>setMenuId(menuId===part.id?null:part.id)}><Ellipsis size={18}/></button>{menuId===part.id && <div className={styles.menu} role="menu" onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();const trigger=menuTrigger.current;setMenuId(null);trigger?.focus({preventScroll:true});}else if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();const choices=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const index=choices.indexOf(document.activeElement as HTMLButtonElement);choices[(index+(event.key==="ArrowDown"?1:choices.length-1))%choices.length]?.focus();}}}><button role="menuitem" type="button" onClick={()=>{closeMenu();setEditor({kind:"createItem",id:part.id,name:""});}}>준비물 추가</button><button role="menuitem" type="button" onClick={()=>{closeMenu();setEditor({kind:"renamePart",id:part.id,name:part.name});}}>카테고리 이름 수정</button><button role="menuitem" type="button" className={styles.menuDanger} onClick={()=>prepareDelete("part",part.id)}>카테고리 삭제</button></div>}</div><p className={styles.partProgress}>{part.items.filter(item=>item.checked).length} / {part.items.length}</p><ul className={styles.items}>{[...part.items].sort((a,b)=>a.position-b.position).map(item=><li key={item.id} className={styles.item} data-selected={selected?.id===item.id}><label className={styles.checkbox}><input type="checkbox" aria-label={`${item.name} 준비 완료`} checked={item.checked} disabled={!ready} onChange={event=>void coordinator?.execute({type:"checkItem",id:item.id,checked:event.target.checked})}/><span aria-hidden="true">✓</span></label><button type="button" className={styles.itemSelect} aria-label={`준비물 선택: ${item.name}`} onClick={()=>{setSelectedId(item.id);setDetailOpen(true);}}><strong>{item.name}</strong>{item.memo && <small>{item.memo.content}</small>}</button></li>)}</ul><button type="button" className={styles.addItem} onClick={()=>setEditor({kind:"createItem",id:part.id,name:""})} aria-label={`준비물 추가: ${part.name}`}><Plus size={14} aria-hidden="true"/> 준비물 추가</button></section>)}
      </div>}
    </div></div>
    <Detail item={selected} context={context} open={detailOpen && (selectedId===null || selected?.id===selectedId)} onClose={()=>setDetailOpen(false)} onRename={()=>selected&&setEditor({kind:"renameItem",id:selected.id,name:selected.name})} onDelete={()=>selected&&prepareDelete("item",selected.id)}/>
    {editor && <NameDialog key={`${editor.kind}:${"id" in editor?editor.id:"new"}`} editor={editor} context={context} onClose={()=>setEditor(null)}/>}
    {state.confirmation && <DeleteDialog key={`${state.confirmation.kind}:${state.confirmation.id}:${state.confirmation.version}`} context={context} onClose={()=>coordinator?.cancelConfirmation()}/>}
  </div>;
}
export function PackingPage(){const context=usePackingList();return <PackingContent key={`${context.scopeKey}:${context.state.data?.id ?? "loading"}`} context={context}/>;}
