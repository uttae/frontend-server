"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { usePackingList } from "@/hooks/usePackingList";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import type { PackingItem, PackingPart } from "@/lib/packing/types";
import { normalizePackingName, normalizePackingMemo } from "@/lib/packing/validation";
import styles from "./PackingPage.module.css";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

type Context = ReturnType<typeof usePackingList>;
type Coordinator = NonNullable<Context["coordinator"]>;
const control = "min-h-10 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:cursor-not-allowed";
const field = "w-full min-w-0 rounded-lg border border-gray-300 bg-white p-2 text-sm focus-visible:outline-2 focus-visible:outline-primary";
function linked(text: string) { return renderTextWithLinks(text, { linkClassName: "text-primary underline [overflow-wrap:anywhere]", onLinkClick: e => e.stopPropagation() }); }

function DraftForm({ initial = "", label, kind, ready, onSave, onCancel, onDelete }: { initial?: string; label: string; kind: "part" | "item" | "memo"; ready: boolean; onSave: (value: string) => Promise<boolean>; onCancel: () => void; onDelete?: () => Promise<boolean> }) {
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
  return <form onSubmit={submit} className="min-w-0 space-y-2" onKeyDown={e => { if(e.key === "Escape") {e.stopPropagation();onCancel();} if(e.key === "Enter" && (composing.current || e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); }}>
    <label className="block text-sm font-medium">{label}{kind === "memo" ? <textarea {...props} rows={4} /> : <input {...props} />}</label>
    {kind === "memo" && <p className="text-xs text-gray-500">{value.length}/2000</p>}
    {error && <p id={errorId} role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap justify-end gap-1">{onDelete && <button type="button" className={control} disabled={!ready} onClick={removeMemo}>메모 삭제</button>}<button type="button" className={control} onClick={onCancel}>취소</button><button type="submit" className={control} disabled={!ready}>{initial || kind === "memo" ? "저장" : "추가"}</button></div>
  </form>;
}

function Item({item,coordinator,ready}: {item:PackingItem;coordinator:Coordinator;ready:boolean}) {
  const [editor,setEditor] = useState<"name"|"memo"|null>(null);
  const checkedId = useId();
  async function save(type:"renameItem"|"saveMemo",value:string) {
    const result = await coordinator.execute(type === "renameItem" ? {type,id:item.id,name:value} : {type,id:item.id,content:value});
    return result.kind === "success" || result.kind === "missing";
  }
  return <li className="min-w-0 space-y-2 py-3">
    <div className="flex min-w-0 items-start gap-2">
      <input id={checkedId} type="checkbox" checked={item.checked} disabled={!ready} aria-label={`${item.name} 준비 완료`} className="mt-3 size-4 shrink-0 accent-primary" onChange={e => void coordinator.execute({type:"checkItem",id:item.id,checked:e.target.checked})} />
      <div className="min-w-0 flex-1">
        {editor === "name" ? <DraftForm initial={item.name} label="준비물 이름" kind="item" ready={ready} onSave={v => save("renameItem",v)} onCancel={() => setEditor(null)} /> : <div className="min-w-0 py-2 text-sm [overflow-wrap:anywhere]"><span className={item.checked ? "text-gray-500 line-through" : ""}>{linked(item.name)}</span></div>}
        <div className="flex flex-wrap gap-1"><button type="button" className={control} onClick={() => setEditor("memo")}>{item.memo ? "메모" : "+ 메모"}</button><button type="button" className={control} aria-label={`준비물 이름 수정: ${item.name}`} onClick={() => setEditor("name")}>수정</button><button type="button" className={control} aria-label={`준비물 삭제: ${item.name}`} disabled={!ready} onClick={() => void coordinator.prepareDelete("item",item.id)}>삭제</button></div>
      </div>
    </div>
    {editor === "memo" ? <div className="rounded-xl bg-gray-50 p-3"><DraftForm initial={item.memo?.content ?? ""} label="준비물 메모" kind="memo" ready={ready} onSave={v => save("saveMemo",v)} onCancel={() => setEditor(null)} onDelete={item.memo ? async () => { const r = await coordinator.execute({type:"deleteMemo",id:item.id}); return r.kind === "success" || r.kind === "missing"; } : undefined} /></div> : item.memo && <div className="whitespace-pre-wrap rounded-xl bg-gray-100 p-3 text-sm [overflow-wrap:anywhere]">{linked(item.memo.content)}</div>}
  </li>;
}

function Part({part,open,toggle,coordinator,ready}: {part:PackingPart;open:boolean;toggle:()=>void;coordinator:Coordinator;ready:boolean}) {
  const [editing,setEditing] = useState(false);
  const [adding,setAdding] = useState(false);
  const bodyId = useId();
  return <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <h2 className="min-w-0 flex-1 text-base font-bold [overflow-wrap:anywhere]">{part.name}</h2>
      <button type="button" className={`${control} ${styles.collapse}`} aria-label={`${part.name} 펼치기 또는 접기`} aria-expanded={open} aria-controls={bodyId} onClick={toggle}>{open ? "접기" : "펼치기"}</button>
      <button type="button" className={control} aria-label={`파트 이름 수정: ${part.name}`} onClick={() => setEditing(true)}>수정</button>
      <button type="button" className={control} aria-label={`파트 삭제: ${part.name}`} disabled={!ready} onClick={() => void coordinator.prepareDelete("part",part.id)}>삭제</button>
    </div>
    {editing && <DraftForm initial={part.name} label="파트 이름" kind="part" ready={ready} onSave={async name => {const r=await coordinator.execute({type:"renamePart",id:part.id,name});return r.kind === "success" || r.kind === "missing";}} onCancel={() => setEditing(false)} />}
    <div id={bodyId} className={styles.body} data-expanded={open}>
      <ul className="divide-y divide-gray-100">{[...part.items].sort((a,b) => a.position-b.position).map(item => <Item key={item.id} item={item} coordinator={coordinator} ready={ready} />)}</ul>
      {part.items.length === 0 && <p className="py-4 text-sm text-gray-500">준비물을 추가해 주세요.</p>}
      {adding ? <DraftForm label="새 준비물 이름" kind="item" ready={ready} onSave={async name => {const r=await coordinator.execute({type:"createItem",partId:part.id,name});return r.kind === "success" || r.kind === "missing";}} onCancel={() => setAdding(false)} /> : <button type="button" className={`${control} w-full border border-dashed border-gray-300`} aria-label={`준비물 추가: ${part.name}`} onClick={() => setAdding(true)}>+ 준비물 추가</button>}
    </div>
  </section>;
}

function DeleteDialog({context}: {context:Context}) {
  const confirmation = context.state.confirmation;
  if(!confirmation || !context.coordinator) return null;
  return <SettingsDialog title={`${confirmation.kind === "part" ? "파트" : "준비물"} 삭제`} onClose={context.coordinator.cancelConfirmation}>
    <p className="my-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{confirmation.name}을(를) 삭제할까요? 포함된 준비물과 메모가 삭제되며 실행 취소할 수 없어요.</p>
    <div className="flex justify-end gap-2"><button type="button" className={control} onClick={context.coordinator.cancelConfirmation}>취소</button><button type="button" className={`${control} text-red-700`} disabled={context.state.status !== "ready"} onClick={() => void context.coordinator?.confirmDelete()}>삭제</button></div>
  </SettingsDialog>;
}

function PackingContent({context}: {context:Context}) {
  const {state,coordinator}=context;
  const [expanded,setExpanded] = useState<Set<number>>(() => new Set(state.data?.parts.slice().sort((a,b) => a.column-b.column || a.position-b.position).slice(0,1).map(p => p.id)));
  const [adding,setAdding]=useState(false);
  const toasts = useRef(new Map<number,string|number>());
  useEffect(() => { const active = new Set(state.undo.map(u=>u.id)); for(const [id,toastId] of toasts.current) if(!active.has(id)) {toast.dismiss(toastId);toasts.current.delete(id);} for(const undo of state.undo) if(!toasts.current.has(undo.id)) {const toastId=toast(`${undo.name} 삭제됨`,{duration:undo.remainingMs,action:{label:"실행 취소",onClick:()=>void coordinator?.restore(undo.id)}});toasts.current.set(undo.id,toastId);} },[state.undo,coordinator]);
  useEffect(() => {const owned = toasts.current;return () => {for(const id of owned.values()) toast.dismiss(id);owned.clear();};},[]);
  const data=state.data;
  const ready=state.status === "ready";
  const items=data?.parts.flatMap(p=>p.items) ?? [];
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-50/50">
    <div className="shrink-0 border-b border-gray-200 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">개인 준비물</h1><p className="mt-1 text-sm text-gray-500">나만 볼 수 있는 여행 준비 목록{data && <span className="ml-2">{items.filter(i=>i.checked).length}/{items.length}</span>}</p></div><div className="flex flex-wrap gap-1"><button type="button" className={control} disabled={!coordinator || state.status === "writing" || state.status === "loading"} onClick={() => void coordinator?.refresh(true)}>새로고침</button>{data && <button type="button" className={control} onClick={() => setAdding(true)}>+ 파트 추가</button>}</div></div></div>
    <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-6">
      {state.message && <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{state.message}{["sync-error","uncertain","error"].includes(state.status) && <button type="button" className={control} onClick={() => void coordinator?.refresh(true)}>다시 확인</button>}</div>}
      {!data ? <p role="status">{state.status === "loading" ? "준비물을 불러오는 중…" : "준비물을 확인할 수 없어요."}</p> : coordinator && <>
        {adding && <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4"><DraftForm label="새 파트 이름" kind="part" ready={ready} onSave={async name => {const result=await coordinator.execute({type:"createPart",name});if(result.kind === "success" && result.createdPartId !== undefined) setExpanded(prev=>new Set([...prev,result.createdPartId!]));return result.kind === "success";}} onCancel={()=>setAdding(false)} /></div>}
        {data.parts.length === 0 && <p className="mb-4 text-sm text-gray-500">아직 파트가 없어요. 새 파트를 추가해 주세요.</p>}
        <div className={styles.columns}>{[0,1,2].map(column=><div key={column} className="min-w-0 space-y-6">{data.parts.filter(p=>p.column === column).sort((a,b)=>a.position-b.position).map(part=><Part key={part.id} part={part} open={expanded.has(part.id)} toggle={()=>setExpanded(prev=>{const next=new Set(prev);if(next.has(part.id))next.delete(part.id);else next.add(part.id);return next;})} coordinator={coordinator} ready={ready}/>)}</div>)}</div>
      </>}
    </div>
    {state.confirmation && <DeleteDialog key={`${state.confirmation.kind}:${state.confirmation.id}:${state.confirmation.version}`} context={context}/>}
  </div>;
}
export function PackingPage() { const context=usePackingList();return <PackingContent key={`${context.scopeKey}:${context.state.data?.id ?? "loading"}`} context={context}/>; }
