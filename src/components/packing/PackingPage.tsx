"use client";

import { useEffect, useLayoutEffect, useCallback, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { MemoIcon } from "@/components/icons/MemoIcon";
import { usePackingList } from "@/hooks/usePackingList";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import type { PackingItem, PackingPart } from "@/lib/packing/types";
import { normalizePackingName, normalizePackingMemo } from "@/lib/packing/validation";
import styles from "./PackingPage.module.css";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

type Context = ReturnType<typeof usePackingList>;
type PrepareDelete = (kind: "item" | "part", id: number, trigger: HTMLButtonElement) => void;
type Coordinator = NonNullable<Context["coordinator"]>;
const control = "min-h-10 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed";
const field = "w-full min-w-0 rounded-lg border border-gray-300 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
function linked(text: string) { return renderTextWithLinks(text, { linkClassName: "text-primary underline [overflow-wrap:anywhere]", onLinkClick: e => e.stopPropagation() }); }

function DraftForm({ initial = "", label, kind, ready, onSave, onCancel, onDelete }: { initial?: string; label: string; kind: "part" | "item" | "memo"; ready: boolean; onSave: (value: string) => Promise<boolean>; onCancel: () => void; onDelete?: () => Promise<boolean> }) {
  const formRef = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const opener = document.activeElement;
    form.querySelector<HTMLElement>("input, textarea")?.focus({preventScroll:true});
    return () => {
      if (form.contains(document.activeElement) && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({preventScroll:true});
      }
    };
  }, []);
  const [value, setValue] = useState(initial);
  const latestValue = useRef(initial);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const composing = useRef(false);
  const errorId = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || lock.current || composing.current) return;
    try { if(kind === "memo") normalizePackingMemo(value); else normalizePackingName(value, kind); }
    catch(e) { setError(e instanceof Error ? e.message : "입력 내용을 확인해 주세요."); return; }
    lock.current = true;
    // Keep focus on an enabled control while the submit button becomes disabled.
    if (formRef.current?.contains(document.activeElement)) {
      formRef.current.querySelector<HTMLElement>("input, textarea")?.focus({preventScroll:true});
    }
    try { if(await onSave(value) && mounted.current && latestValue.current === value) onCancel(); } finally { lock.current = false; }
  }
  async function removeMemo() {
    if (!ready || lock.current || !onDelete) return;
    const submittedValue = latestValue.current;
    lock.current = true;
    try {
      if (await onDelete() && mounted.current && latestValue.current === submittedValue) onCancel();
    } finally { lock.current = false; }
  }
  const props = { "aria-label": label, "aria-describedby": error ? errorId : undefined, className: field, value, onChange: (e: {target:{value:string}}) => {latestValue.current = e.target.value;setValue(e.target.value);setError("");}, onCompositionStart: () => {composing.current=true;}, onCompositionEnd: () => {composing.current=false;} };
  return <form ref={formRef} onSubmit={submit} className={`min-w-0 space-y-2 ${styles.draft}`} onKeyDown={e => { if(e.key === "Escape") {e.stopPropagation();onCancel();} if(e.key === "Enter" && (composing.current || e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); }}>
    <label className="block text-sm font-medium"><span className={kind === "memo" ? "sr-only" : undefined}>{label}</span>{kind === "memo" ? <textarea {...props} rows={4} /> : <input {...props} />}</label>
    {kind === "memo" && <p className="text-xs text-gray-500">{value.length}/2000</p>}
    {error && <p id={errorId} role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap justify-end gap-1">{onDelete && <button type="button" className={control} disabled={!ready} onClick={removeMemo}>메모 삭제</button>}<button type="button" className={control} onClick={onCancel}>취소</button><button type="submit" className={`${control} ${styles.save}`} disabled={!ready}>{initial || kind === "memo" ? "저장" : "추가"}</button></div>
  </form>;
}

function Item({item,coordinator,ready,prepareDelete}: {item:PackingItem;coordinator:Coordinator;ready:boolean;prepareDelete:PrepareDelete}) {
  const [editor,setEditor] = useState<"name"|"memo"|null>(null);
  const checkedId = useId();
  const memoTrigger = useRef<HTMLButtonElement>(null);
  async function removeSavedMemo(button: HTMLButtonElement) {
    const result = await coordinator.execute({type:"deleteMemo",id:item.id});
    if ((result.kind === "success" || result.kind === "missing") &&
        (document.activeElement === button || (!button.isConnected && document.activeElement === document.body))) {
      memoTrigger.current?.focus({preventScroll:true});
    }
  }
  async function save(type:"renameItem"|"saveMemo",value:string) {
    const result = await coordinator.execute(type === "renameItem" ? {type,id:item.id,name:value} : {type,id:item.id,content:value});
    return result.kind === "success" || result.kind === "missing";
  }
  return <li className={styles.item}>
    <div className={styles.itemRow}>
      <input id={checkedId} type="checkbox" checked={item.checked} disabled={!ready} aria-label={`${item.name} 준비 완료`} className={styles.checkbox} onChange={e => void coordinator.execute({type:"checkItem",id:item.id,checked:e.target.checked})} />
      <div className={styles.itemName} title={item.name}>{linked(item.name)}</div>
      <button type="button" className={`${styles.iconButton} ${styles.itemRename}`} aria-label={`준비물 이름 수정: ${item.name}`} title="준비물 이름 수정" onClick={() => setEditor("name")}><Pencil size={14} aria-hidden="true" /></button>
      <button ref={memoTrigger} type="button" className={styles.memoButton} aria-label={`${item.memo ? "메모" : "메모 추가"}: ${item.name}`} onClick={() => setEditor("memo")}>{item.memo ? "메모" : "+ 메모"}</button>
      <button type="button" className={styles.iconButton} aria-label={`준비물 삭제: ${item.name}`} title="준비물 삭제" disabled={!ready} onClick={event => prepareDelete("item",item.id,event.currentTarget)}><X size={20} strokeWidth={1.5} aria-hidden="true" /></button>
    </div>
    {editor === "name" && <div className={styles.editor}><DraftForm initial={item.name} label="준비물 이름" kind="item" ready={ready} onSave={v => save("renameItem",v)} onCancel={() => setEditor(null)} /></div>}
    {editor === "memo" ? <div className={styles.memoEditor}><MemoIcon className={styles.memoIcon} /><DraftForm initial={item.memo?.content ?? ""} label="준비물 메모" kind="memo" ready={ready} onSave={v => save("saveMemo",v)} onCancel={() => setEditor(null)} onDelete={item.memo ? async () => { const r = await coordinator.execute({type:"deleteMemo",id:item.id}); return r.kind === "success" || r.kind === "missing"; } : undefined} /></div> : item.memo && <div className={styles.memo}><MemoIcon className={styles.memoIcon} /><div className={styles.memoText}>{linked(item.memo.content)}</div><button type="button" className={styles.iconButton} aria-label={`메모 삭제: ${item.name}`} title="메모 삭제" disabled={!ready} onClick={event => void removeSavedMemo(event.currentTarget)}><Trash2 size={16} aria-hidden="true" /></button></div>}
  </li>;
}

function Part({part,open,toggle,coordinator,ready,prepareDelete}: {part:PackingPart;open:boolean;toggle:()=>void;coordinator:Coordinator;ready:boolean;prepareDelete:PrepareDelete}) {
  const [editing,setEditing] = useState(false);
  const [adding,setAdding] = useState(false);
  const bodyId = useId();
  return <section className={styles.part}>
    <div className={styles.partHeader}>
      <div className={styles.partTitle}><h2 title={part.name}>{part.name}</h2><span aria-label={`${part.name} 준비 현황`}>{part.items.filter(item => item.checked).length} / {part.items.length}</span></div>
      <div className={styles.partActions}>
        <button type="button" className={styles.iconButton} aria-label={`파트 이름 수정: ${part.name}`} title="파트 이름 수정" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /></button>
        <button type="button" className={styles.iconButton} aria-label={`파트 삭제: ${part.name}`} title="파트 삭제" disabled={!ready} onClick={event => prepareDelete("part",part.id,event.currentTarget)}><Trash2 size={14} aria-hidden="true" /></button>
      </div>
      <button type="button" className={styles.addItem} aria-label={`준비물 추가: ${part.name}`} onClick={() => {setAdding(true);if(!open) toggle();}}>+ 추가</button>
      <button type="button" className={`${styles.iconButton} ${styles.collapse}`} aria-label={`${part.name} 펼치기 또는 접기`} aria-expanded={open} aria-controls={bodyId} onClick={toggle}><ChevronDown size={18} aria-hidden="true" /></button>
    </div>
    {editing && <div className={styles.editor}><DraftForm initial={part.name} label="파트 이름" kind="part" ready={ready} onSave={async name => {const r=await coordinator.execute({type:"renamePart",id:part.id,name});return r.kind === "success" || r.kind === "missing";}} onCancel={() => setEditing(false)} /></div>}
    <div id={bodyId} className={styles.body} data-expanded={open}>
      <ul>{[...part.items].sort((a,b) => a.position-b.position).map(item => <Item key={item.id} item={item} coordinator={coordinator} ready={ready} prepareDelete={prepareDelete} />)}</ul>
      {part.items.length === 0 && <p className="py-4 text-sm text-gray-500">준비물을 추가해 주세요.</p>}
      {adding && <div className={styles.editor}><DraftForm label="새 준비물 이름" kind="item" ready={ready} onSave={async name => {const r=await coordinator.execute({type:"createItem",partId:part.id,name});return r.kind === "success" || r.kind === "missing";}} onCancel={() => setAdding(false)} /></div>}
    </div>
  </section>;
}

function DeleteDialog({context,onCancel}: {context:Context;onCancel:()=>void}) {
  const confirmation = context.state.confirmation;
  if(!confirmation || !context.coordinator) return null;
  return <SettingsDialog title={`${confirmation.kind === "part" ? "파트" : "준비물"} 삭제`} onClose={onCancel}>
    <p className="my-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{confirmation.name}을(를) 삭제할까요? 포함된 준비물과 메모가 삭제되며 실행 취소할 수 없어요.</p>
    <div className="flex justify-end gap-2"><button type="button" className={control} onClick={onCancel}>취소</button><button type="button" className={`${control} text-red-700`} disabled={context.state.status !== "ready"} onClick={() => void context.coordinator?.confirmDelete()}>삭제</button></div>
  </SettingsDialog>;
}

function PackingContent({context}: {context:Context}) {
  const {state,coordinator}=context;
  const [expanded,setExpanded] = useState<Set<number>>(() => new Set(state.data?.parts.slice().sort((a,b) => a.column-b.column || a.position-b.position).slice(0,1).map(p => p.id)));
  const [adding,setAdding]=useState(false);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreCancelledDelete = useRef(false);
  const prepareDelete: PrepareDelete = (kind,id,trigger) => {
    deleteTrigger.current = trigger;
    void coordinator?.prepareDelete(kind,id);
  };
  const cancelDelete = useCallback(() => {
    const active = document.activeElement;
    restoreCancelledDelete.current = active === document.body || !!active?.closest("dialog");
    coordinator?.cancelConfirmation();
  }, [coordinator]);
  useEffect(() => {
    if (state.confirmation || !restoreCancelledDelete.current) return;
    restoreCancelledDelete.current = false;
    // Child dialog cleanup removes inert and performs its generic restoration first.
    const trigger = deleteTrigger.current;
    if (trigger?.isConnected && !trigger.disabled) trigger.focus({preventScroll:true});
    deleteTrigger.current = null;
  }, [state.confirmation]);
  const toasts = useRef(new Map<number,string|number>());
  useEffect(() => { const active = new Set(state.undo.map(u=>u.id)); for(const [id,toastId] of toasts.current) if(!active.has(id)) {toast.dismiss(toastId);toasts.current.delete(id);} for(const undo of state.undo) if(!toasts.current.has(undo.id)) {const toastId=toast(`${undo.name} 삭제됨`,{duration:undo.remainingMs,action:{label:"실행 취소",onClick:()=>void coordinator?.restore(undo.id)}});toasts.current.set(undo.id,toastId);} },[state.undo,coordinator]);
  useEffect(() => {const owned = toasts.current;return () => {for(const id of owned.values()) toast.dismiss(id);owned.clear();};},[]);
  const data=state.data;
  const ready=state.status === "ready";
  const items=data?.parts.flatMap(p=>p.items) ?? [];
  return <div className={styles.page}>
    <div className={styles.scroll}>
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div><h1>준비물 체크리스트</h1><p className={styles.subtitle}>해외여행 공통 준비물</p></div>
          {data && <p className={styles.progress} aria-label="전체 준비 현황">{items.filter(i=>i.checked).length} / {items.length}개 준비 완료</p>}
          {data && <button type="button" className={styles.addPart} onClick={() => setAdding(true)}>+ 파트 추가</button>}
        </header>
      {state.message && <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{state.message}{["sync-error","uncertain","error"].includes(state.status) && <button type="button" className={control} onClick={() => void coordinator?.refresh(true)}>다시 확인</button>}</div>}
      {!data ? <p role="status">{state.status === "loading" ? "준비물을 불러오는 중…" : "준비물을 확인할 수 없어요."}</p> : coordinator && <>
        {adding && <div className={styles.newPart}><DraftForm label="새 파트 이름" kind="part" ready={ready} onSave={async name => {const result=await coordinator.execute({type:"createPart",name});if(result.kind === "success" && result.createdPartId !== undefined) setExpanded(prev=>new Set([...prev,result.createdPartId!]));return result.kind === "success";}} onCancel={()=>setAdding(false)} /></div>}
        {data.parts.length === 0 && <p className="mb-4 text-sm text-gray-500">아직 파트가 없어요. 새 파트를 추가해 주세요.</p>}
        <div className={styles.columns}>{[0,1,2].map(column=><div key={column} className="min-w-0 space-y-6">{data.parts.filter(p=>p.column === column).sort((a,b)=>a.position-b.position).map(part=><Part key={part.id} part={part} open={expanded.has(part.id)} toggle={()=>setExpanded(prev=>{const next=new Set(prev);if(next.has(part.id))next.delete(part.id);else next.add(part.id);return next;})} coordinator={coordinator} ready={ready} prepareDelete={prepareDelete}/>)}</div>)}</div>
      </>}
      </div>
    </div>
    {state.confirmation && <DeleteDialog key={`${state.confirmation.kind}:${state.confirmation.id}:${state.confirmation.version}`} context={context} onCancel={cancelDelete}/>}
  </div>;
}
export function PackingPage() { const context=usePackingList();return <PackingContent key={`${context.scopeKey}:${context.state.data?.id ?? "loading"}`} context={context}/>; }
