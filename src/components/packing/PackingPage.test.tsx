// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PackingItem } from '@/lib/packing/types';
import { PackingPage } from './PackingPage';

const mocks = vi.hoisted(() => ({context: null as unknown, mobile: false}));
vi.mock('@/hooks/usePackingList', () => ({usePackingList: () => mocks.context}));
// PC는 오른쪽 상세 패널(aside), 모바일 기기는 아래 시트(Drawer)를 그린다
vi.mock('@/contexts/MobileViewContext', async importOriginal => ({
  ...await importOriginal<typeof import('@/contexts/MobileViewContext')>(),
  useMobileView: () => ({isMobileDevice: mocks.mobile}),
}));
const item: PackingItem = {id:11,partId:1,name:'여권',checked:false,position:0,memo:{id:11,itemId:11,content:'기존 메모'},tips:['유효기간을 확인하세요.','사본을 준비하세요.']};
const second: PackingItem = {id:12,partId:1,name:'항공권 예약 내역',checked:true,position:1,memo:null,tips:[]};
const data = {id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[item,second]},{id:2,name:'통신·전자기기',column:0,position:1,items:[]},{id:3,name:'옷·가방',column:1,position:2,items:[]},{id:4,name:'세면·건강',column:2,position:3,items:[]}]};
let state: {data: typeof data|null; status:string; message:string|null; confirmation: null|{kind:'item'|'part';id:number;version:number;name:string}};
let coordinator: {execute:ReturnType<typeof vi.fn>;prepareDelete:ReturnType<typeof vi.fn>;confirmDelete:ReturnType<typeof vi.fn>;cancelConfirmation:ReturnType<typeof vi.fn>;refresh:ReturnType<typeof vi.fn>};
let host: HTMLDivElement;
let root: Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  mocks.mobile=false;
  state={data:structuredClone(data),status:'ready',message:null,confirmation:null};
  coordinator={execute:vi.fn().mockResolvedValue({kind:'success'}),prepareDelete:vi.fn(),confirmDelete:vi.fn(),cancelConfirmation:vi.fn(),refresh:vi.fn()};
  mocks.context={state,coordinator,scopeKey:'room:user'};
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());document.body.replaceChildren();vi.unstubAllGlobals();});

// Base UI는 첫 포커스·닫힘 정리를 다음 프레임 이후에 한다
const settle=()=>act(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>resolve(null)));await new Promise(resolve=>setTimeout(resolve,0));});
async function mount(){await act(async()=>root.render(<PackingPage/>));await settle();}
async function rerender(){await act(async()=>root.render(<PackingPage/>));await settle();}
function accessibleName(node:Element){
  const labelledBy=node.getAttribute('aria-labelledby');
  if(labelledBy) return labelledBy.split(' ').map(id=>document.getElementById(id)?.textContent ?? '').join(' ');
  return node.getAttribute('aria-label') ?? node.textContent ?? '';
}
const openDialogs=()=>Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-open],[role="alertdialog"][data-open]'));
// 열린 대화상자·시트가 있으면 맨 위 것 안에서, 없으면 화면 전체에서 찾는다(모달 뒤 요소는 누를 수 없다)
function button(label:string){
  const scope:ParentNode=openDialogs().at(-1) ?? document;
  const found=Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(node=>accessibleName(node)===label);
  if(!found) throw new Error(`button not found: ${label}`);
  return found;
}
const menuItem=(label:string)=>document.querySelector<HTMLElement>(`[role="menuitem"][aria-label="${label}"]`)!;
const checkbox=(label:string)=>document.querySelector<HTMLElement>(`[role="checkbox"][aria-label="${label}"]`)!;
const input=(label:string)=>document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const memo=()=>document.querySelector<HTMLTextAreaElement>('textarea[aria-label="준비물 메모"]');
const detail=()=>document.querySelector<HTMLElement>('aside[aria-label="준비물 상세"]')!;
const selectedName=()=>document.querySelector('[aria-label="선택한 준비물 이름"]')!.textContent;
const sheet=()=>document.querySelector<HTMLElement>('[role="dialog"][data-open]');
const detailOpen=()=>mocks.mobile ? sheet()!==null : !detail().hidden;
const text=()=>document.body.textContent ?? '';
async function click(element:HTMLElement){await act(async()=>element.click());await settle();}
async function type(element:HTMLInputElement|HTMLTextAreaElement,value:string){
  const prototype=element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(element,value);
    element.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
async function escape(target:EventTarget=document){
  await act(async()=>{target.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});
  await settle();
}
async function selectFirstItem(){await click(button('준비물 선택: 여권'));}
async function openMenu(part:string){await click(button(`카테고리 메뉴: ${part}`));}
function deferred(){let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));return (value:{kind:string})=>act(async()=>{finish(value);await Promise.resolve();});}

it('starts on the full board without selecting an item or showing detail controls', async () => {
  await mount();
  expect(detail().hidden).toBe(true);
  expect(memo()).toBeNull();
  expect(button('준비물 선택: 여권').getAttribute('aria-pressed')).toBe('false');
});
it('collapses the selected detail and preserves its memo draft when reopened', async () => {
  await mount();
  await selectFirstItem();
  await type(memo()!,'작성 중인 메모');
  await click(button('준비물 상세 접기'));
  expect(detail().hidden).toBe(true);
  await selectFirstItem();
  expect(detail().hidden).toBe(false);
  expect(memo()!.value).toBe('작성 중인 메모');
});
it('changes the selected item check state from the detail panel', async () => {
  await mount();
  await selectFirstItem();
  await click(detail().querySelector<HTMLElement>('[role="checkbox"][aria-label="상세: 여권 준비 완료"]')!);
  expect(coordinator.execute).toHaveBeenCalledWith({type:'checkItem', id:11, checked:true});
  expect(selectedName()).toBe('여권');
});
it('shows four ordered category columns and authoritative progress',async()=>{
  await mount();
  const board=document.querySelector('[aria-label="준비물 카테고리"]')!;
  expect(Array.from(board.querySelectorAll('section')).map(node=>node.getAttribute('aria-label'))).toEqual(['여권·예약·결제','통신·전자기기','옷·가방','세면·건강']);
  expect(document.querySelector('[aria-label="전체 준비 현황"] strong')!.textContent).toContain('1 / 2');
});
it('renders added categories after the four defaults even when they share backend column 2',async()=>{
  state.data!.parts.push({id:5,name:'추가 준비 1',column:2,position:8,items:[]},{id:6,name:'추가 준비 2',column:2,position:9,items:[]});
  await mount();
  const board=document.querySelector('[aria-label="준비물 카테고리"]')!;
  expect(Array.from(board.querySelectorAll('section')).map(node=>node.getAttribute('aria-label'))).toEqual([
    '여권·예약·결제','통신·전자기기','옷·가방','세면·건강','추가 준비 1','추가 준비 2',
  ]);
});
it('selects an item and shows only its server supplied tips',async()=>{
  await mount();await selectFirstItem();
  expect(text()).toContain('유효기간을 확인하세요.');
  expect(text()).toContain('사본을 준비하세요.');
  await click(button('준비물 선택: 항공권 예약 내역'));
  expect(text()).not.toContain('유효기간을 확인하세요.');
  expect(text()).not.toContain('우때의 여행 팁');
});
it('keeps checkbox independent from item selection',async()=>{
  await mount();await selectFirstItem();
  await click(checkbox('항공권 예약 내역 준비 완료'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'checkItem',id:12,checked:false});
  expect(selectedName()).toBe('여권');
});
it('opens the category menu and sends validated create and rename commands',async()=>{
  await mount();
  await openMenu('여권·예약·결제');
  await click(menuItem('카테고리 이름 수정'));
  expect(input('카테고리 이름')!.value).toBe('여권·예약·결제');
  await type(input('카테고리 이름')!,'새 카테고리');
  await click(button('저장'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'renamePart',id:1,name:'새 카테고리'});
});
it('closes a category menu with Escape',async()=>{
  await mount();
  await openMenu('여권·예약·결제');
  expect(document.querySelector('[role="menu"]')).not.toBeNull();
  await escape(menuItem('준비물 추가'));
  expect(document.querySelector('[role="menu"]')).toBeNull();
});
it('opens an item add dialog for the selected category',async()=>{
  await mount();
  await click(button('준비물 추가: 여권·예약·결제'));
  expect(accessibleName(openDialogs().at(-1)!)).toBe('준비물 추가');
  await type(input('준비물 이름')!,'비상 연락처');
  await click(button('추가'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'createItem',partId:1,name:'비상 연락처'});
});
it('creates a category without replacing the existing list',async()=>{
  await mount();
  await click(button('카테고리 추가'));
  await type(input('카테고리 이름')!,'추가 준비');
  await click(button('추가'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'createPart',name:'추가 준비'});
  expect(state.data!.parts).toHaveLength(4);
});
it('retains a failed name draft and clears it on scope change',async()=>{
  coordinator.execute.mockResolvedValue({kind:'error'});
  await mount();
  await click(button('카테고리 추가'));
  await type(input('카테고리 이름')!,'개인용');
  await click(button('추가'));
  expect(input('카테고리 이름')!.value).toBe('개인용');
  mocks.context={state,coordinator,scopeKey:'other:user'};
  await rerender();
  expect(input('카테고리 이름')).toBeNull();
});
it('does not submit a Korean name while IME composition is active',async()=>{
  await mount();await click(button('카테고리 추가'));
  const name=input('카테고리 이름')!;
  await type(name,'여권');
  await act(async()=>{name.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));});
  const enter=new KeyboardEvent('keydown',{key:'Enter',keyCode:229,bubbles:true,cancelable:true});
  await act(async()=>{name.dispatchEvent(enter);});
  expect(enter.defaultPrevented).toBe(true);
  await click(button('추가'));
  expect(coordinator.execute).not.toHaveBeenCalled();
});
it('rejects an overlong raw name and permits a duplicate after correction',async()=>{
  await mount();await click(button('준비물 추가: 여권·예약·결제'));
  await type(input('준비물 이름')!,' '.repeat(100)+'x');
  await click(button('추가'));
  expect(coordinator.execute).not.toHaveBeenCalled();
  expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
  expect(input('준비물 이름')!.getAttribute('aria-invalid')).toBe('true');
  await type(input('준비물 이름')!,'여권');
  await click(button('추가'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'createItem',partId:1,name:'여권'});
});
it('keeps later name edits when an earlier save succeeds',async()=>{
  const finish=deferred();await mount();await selectFirstItem();
  await click(button('준비물 이름 수정: 여권'));
  await type(input('준비물 이름')!,'첫 번째 이름');
  await click(button('저장'));
  await type(input('준비물 이름')!,'두 번째 이름');
  await finish({kind:'success'});
  expect(input('준비물 이름')!.value).toBe('두 번째 이름');
});
it('shows save progress and keeps the name dialog open until the save finishes',async()=>{
  const finish=deferred();await mount();await selectFirstItem();
  await click(button('준비물 이름 수정: 여권'));
  await click(button('저장'));
  // 저장 중: 저장 버튼은 progress, 취소·Esc로 닫히지 않는다(closeDisabled)
  expect(button('저장 중').getAttribute('aria-busy')).toBe('true');
  await click(button('취소'));
  await escape();
  expect(input('준비물 이름')).not.toBeNull();
  await finish({kind:'success'});
  await settle();
  expect(input('준비물 이름')).toBeNull();
  expect(coordinator.execute).toHaveBeenCalledTimes(1);
});
it('closes a name dialog if its target disappeared while saving',async()=>{
  coordinator.execute.mockResolvedValue({kind:'missing'});await mount();await selectFirstItem();
  await click(button('준비물 이름 수정: 여권'));
  await click(button('저장'));
  expect(input('준비물 이름')).toBeNull();
});
it('opens item rename and category delete from their respective controls',async()=>{
  await mount();await selectFirstItem();
  await click(button('준비물 이름 수정: 여권'));
  expect(input('준비물 이름')!.value).toBe('여권');
  await click(button('취소'));
  expect(input('준비물 이름')).toBeNull();
  await openMenu('여권·예약·결제');
  await click(menuItem('카테고리 삭제'));
  expect(coordinator.prepareDelete).toHaveBeenCalledWith('part',1);
});
it('requires a coordinator confirmation before deleting an item',async()=>{
  await mount();await selectFirstItem();
  await click(button('준비물 삭제: 여권'));
  expect(coordinator.prepareDelete).toHaveBeenCalledWith('item',11);
  expect(coordinator.confirmDelete).not.toHaveBeenCalled();
  state.confirmation={kind:'item',id:11,version:1,name:'여권'};
  await rerender();
  expect(openDialogs().at(-1)!.getAttribute('role')).toBe('alertdialog');
  await click(button('삭제'));
  expect(coordinator.confirmDelete).toHaveBeenCalledOnce();
});
it('saves the selected item memo without changing its checked state',async()=>{
  await mount();await selectFirstItem();
  await type(memo()!,'새 메모');
  await click(button('저장'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:'새 메모'});
  expect(state.data!.parts[0].items[0].checked).toBe(false);
});
it('keeps memo markup as text and sends blank memo save without deleting the item',async()=>{
  state.data!.parts[0].items[0]={...item,memo:{id:11,itemId:11,content:'<script>literal</script>'}};
  await mount();await selectFirstItem();
  expect(document.querySelectorAll('script')).toHaveLength(0);
  expect(memo()!.value).toBe('<script>literal</script>');
  await type(memo()!,'   ');
  await click(button('저장'));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:'   '});
  expect(document.querySelector('[aria-label="준비물 카테고리"]')!.querySelectorAll('[role="checkbox"]')).toHaveLength(2);
});
it('preserves newer memo typing when a pending save publishes the submitted text',async()=>{
  const finish=deferred();await mount();await selectFirstItem();
  await type(memo()!,'보낸 메모');
  await click(button('저장'));
  await type(memo()!,'나중에 쓴 메모');
  state.data!.parts[0].items[0]={...item,memo:{id:11,itemId:11,content:'보낸 메모'}};
  await rerender();
  expect(memo()!.value).toBe('나중에 쓴 메모');
  await finish({kind:'success'});
  expect(memo()!.value).toBe('나중에 쓴 메모');
});
it('preserves new memo typing when a pending blank memo save clears the memo',async()=>{
  const finish=deferred();await mount();await selectFirstItem();
  await type(memo()!,'');
  await click(button('저장'));
  await type(memo()!,'삭제 중 새 메모');
  state.data!.parts[0].items[0]={...item,memo:null};
  await rerender();
  await finish({kind:'success'});
  expect(memo()!.value).toBe('삭제 중 새 메모');
});
it('preserves the loading state without fabricated progress or a list',async()=>{
  state.data=null;state.status='loading';
  await mount();
  // 로딩 안내는 화면에 보이지 않는 status(output)로만 전한다
  expect(document.querySelector('output')!.textContent).toContain('불러오는 중');
  expect(document.querySelectorAll('h2')).toHaveLength(0);
  expect(document.querySelector('[aria-label="전체 준비 현황"]')).toBeNull();
});
it('returns to the board when the selected item is removed',async()=>{
  await mount();
  await click(button('준비물 선택: 항공권 예약 내역'));
  expect(detail().getAttribute('data-open')).toBe('true');
  state.data!.parts[0].items=[item];
  await rerender();
  expect(detail().getAttribute('data-open')).toBe('false');
});
it('opens a dismissible mobile detail sheet above the board',async()=>{
  mocks.mobile=true;
  await mount();
  expect(document.querySelector('aside[aria-label="준비물 상세"]')).toBeNull();
  await click(button('준비물 선택: 항공권 예약 내역'));
  expect(sheet()).not.toBeNull();
  expect(accessibleName(sheet()!)).toBe('항공권 예약 내역');
  await click(button('준비물 상세 닫기'));
  expect(sheet()).toBeNull();
  expect(button('준비물 선택: 항공권 예약 내역').getAttribute('aria-pressed')).toBe('false');
});

it.each([false,true])('cancels memo edits and closes the detail (mobile: %s)',async(mobile)=>{
  mocks.mobile=mobile;
  await mount();await selectFirstItem();
  await type(memo()!,'취소할 초안');
  await click(button('취소'));
  expect(detailOpen()).toBe(false);
  expect(coordinator.execute).not.toHaveBeenCalled();
  await selectFirstItem();
  expect(memo()!.value).toBe('기존 메모');
});

it('closes detail only after the memo save succeeds',async()=>{
  const finish=deferred();
  await mount();await selectFirstItem();
  await click(button('저장'));
  expect(detail().hidden).toBe(false);
  await finish({kind:'success'});
  expect(detail().hidden).toBe(true);
});

it.each(['error','blocked'])('keeps the memo draft open when saving returns %s',async(kind)=>{
  coordinator.execute.mockResolvedValue({kind});
  await mount();await selectFirstItem();
  await type(memo()!,'보존할 초안');
  await click(button('저장'));
  expect(detail().hidden).toBe(false);
  expect(memo()!.value).toBe('보존할 초안');
});

it('keeps detail open for edits typed after the memo save started',async()=>{
  const finish=deferred();
  await mount();await selectFirstItem();
  await click(button('저장'));
  await type(memo()!,'나중에 입력한 메모');
  await finish({kind:'success'});
  expect(detail().hidden).toBe(false);
  expect(memo()!.value).toBe('나중에 입력한 메모');
});

it('does not close another item when the previous item memo save finishes',async()=>{
  const finish=deferred();
  await mount();await selectFirstItem();
  await click(button('저장'));
  await click(button('준비물 선택: 항공권 예약 내역'));
  await finish({kind:'success'});
  expect(detail().hidden).toBe(false);
  expect(selectedName()).toBe('항공권 예약 내역');
});

// 모바일 시트의 X는 저장 중(status writing)에 막히므로, 저장 중 닫기는 PC 접기·메모 취소로 본다
it.each([[false,'취소'],[false,'준비물 상세 접기'],[true,'취소']] as const)('does not close a reopened detail when a save finishes (mobile: %s, close: %s)',async(mobile,close)=>{
  mocks.mobile=mobile;
  const finish=deferred();
  await mount();await selectFirstItem();
  await click(button('저장'));
  await click(button(close));
  expect(detailOpen()).toBe(false);
  await selectFirstItem();
  await finish({kind:'success'});
  expect(detailOpen()).toBe(true);
});

it('keeps the mobile memo draft after closing the sheet and does not close it while writing',async()=>{
  mocks.mobile=true;
  await mount();await selectFirstItem();
  await type(memo()!,'닫은 뒤에도 유지할 메모');
  await click(button('준비물 상세 닫기'));
  expect(sheet()).toBeNull();
  await selectFirstItem();
  expect(memo()!.value).toBe('닫은 뒤에도 유지할 메모');
  // 저장 중에는 X·Esc로 닫히지 않는다(closeDisabled)
  state.status='writing';await rerender();
  expect(button('준비물 상세 닫기').disabled).toBe(true);
  await click(button('준비물 상세 닫기'));
  await escape();
  expect(sheet()).not.toBeNull();
  expect(memo()!.value).toBe('닫은 뒤에도 유지할 메모');
});
