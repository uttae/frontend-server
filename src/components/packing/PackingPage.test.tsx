// @vitest-environment jsdom
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { PackingItem } from '@/lib/packing/types';
import { PackingPage } from './PackingPage';

const mocks = vi.hoisted(() => ({context: null as unknown}));
vi.mock('@/hooks/usePackingList', () => ({usePackingList: () => mocks.context}));
vi.mock('@/components/settings/SettingsDialog', () => ({SettingsDialog: ({title, children}: {title:string; children:ReactNode}) => <dialog aria-label={title}>{children}</dialog>}));
const item: PackingItem = {id:11,partId:1,name:'여권',checked:false,position:0,memo:{id:11,itemId:11,content:'기존 메모'},tips:['유효기간을 확인하세요.','사본을 준비하세요.']};
const second: PackingItem = {id:12,partId:1,name:'항공권 예약 내역',checked:true,position:1,memo:null,tips:[]};
const data = {id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[item,second]},{id:2,name:'통신·전자기기',column:0,position:1,items:[]},{id:3,name:'옷·가방',column:1,position:2,items:[]},{id:4,name:'세면·건강',column:2,position:3,items:[]}]};
let state: {data: typeof data|null; status:string; message:string|null; confirmation: null|{kind:'item'|'part';id:number;version:number;name:string}};
let coordinator: {execute:ReturnType<typeof vi.fn>;prepareDelete:ReturnType<typeof vi.fn>;confirmDelete:ReturnType<typeof vi.fn>;cancelConfirmation:ReturnType<typeof vi.fn>;refresh:ReturnType<typeof vi.fn>};
let renderer:ReactTestRenderer;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);state={data:structuredClone(data),status:'ready',message:null,confirmation:null};coordinator={execute:vi.fn().mockResolvedValue({kind:'success'}),prepareDelete:vi.fn(),confirmDelete:vi.fn(),cancelConfirmation:vi.fn(),refresh:vi.fn()};mocks.context={state,coordinator,scopeKey:'room:user'};});
afterEach(()=>{if(renderer)act(()=>renderer.unmount());vi.unstubAllGlobals();});
async function mount(){await act(async()=>{renderer=create(<PackingPage/>);});}
function button(label:string){return renderer.root.findAllByType('button').find(node=>node.props['aria-label']===label || node.children.join('')===label)!;}
function input(label:string){return renderer.root.findAllByType('input').find(node=>node.props['aria-label']===label)!;}
it('shows four ordered category columns and authoritative progress',async()=>{await mount();expect(renderer.root.findByProps({'aria-label':'준비물 카테고리'}).findAllByType('section').map(node=>node.props['aria-label'])).toEqual(['여권·예약·결제','통신·전자기기','옷·가방','세면·건강']);expect(renderer.root.findByProps({'aria-label':'전체 준비 현황'}).children.join('')).toContain('1 / 2');});
it('renders added categories after the four defaults even when they share backend column 2',async()=>{
  state.data!.parts.push({id:5,name:'추가 준비 1',column:2,position:8,items:[]},{id:6,name:'추가 준비 2',column:2,position:9,items:[]});
  await mount();
  expect(renderer.root.findByProps({'aria-label':'준비물 카테고리'}).findAllByType('section').map(node=>node.props['aria-label'])).toEqual([
    '여권·예약·결제','통신·전자기기','옷·가방','세면·건강','추가 준비 1','추가 준비 2',
  ]);
});
it('selects an item and shows only its server supplied tips',async()=>{await mount();expect(JSON.stringify(renderer.toJSON())).toContain('유효기간을 확인하세요.');expect(JSON.stringify(renderer.toJSON())).toContain('사본을 준비하세요.');await act(async()=>button('준비물 선택: 항공권 예약 내역').props.onClick());expect(JSON.stringify(renderer.toJSON())).not.toContain('유효기간을 확인하세요.');expect(JSON.stringify(renderer.toJSON())).not.toContain('여행에 유용한 팁');});
it('keeps checkbox independent from item selection',async()=>{await mount();await act(async()=>input('항공권 예약 내역 준비 완료').props.onChange({target:{checked:false}}));expect(coordinator.execute).toHaveBeenCalledWith({type:'checkItem',id:12,checked:false});expect(renderer.root.findByProps({'aria-label':'선택한 준비물 이름'}).children.join('')).toBe('여권');});
it('opens the category menu and sends validated create and rename commands',async()=>{await mount();await act(async()=>button('카테고리 메뉴: 여권·예약·결제').props.onClick());await act(async()=>button('카테고리 이름 수정').props.onClick());await act(async()=>input('카테고리 이름').props.onChange({target:{value:'새 카테고리'}}));await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(coordinator.execute).toHaveBeenCalledWith({type:'renamePart',id:1,name:'새 카테고리'});});
it('closes a category menu with Escape',async()=>{await mount();const trigger=button('카테고리 메뉴: 여권·예약·결제');await act(async()=>trigger.props.onClick());const menu=renderer.root.findByProps({role:'menu'});await act(async()=>menu.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}}));expect(renderer.root.findAllByProps({role:'menu'})).toHaveLength(0);});
it('opens an item add dialog for the selected category',async()=>{await mount();await act(async()=>button('준비물 추가: 여권·예약·결제').props.onClick());await act(async()=>input('준비물 이름').props.onChange({target:{value:'비상 연락처'}}));await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(coordinator.execute).toHaveBeenCalledWith({type:'createItem',partId:1,name:'비상 연락처'});});
it('creates a category without replacing the existing list',async()=>{await mount();await act(async()=>button('카테고리 추가').props.onClick());await act(async()=>input('카테고리 이름').props.onChange({target:{value:'추가 준비'}}));await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(coordinator.execute).toHaveBeenCalledWith({type:'createPart',name:'추가 준비'});expect(state.data!.parts).toHaveLength(4);});
it('retains a failed name draft and clears it on scope change',async()=>{coordinator.execute.mockResolvedValue({kind:'error'});await mount();await act(async()=>button('카테고리 추가').props.onClick());await act(async()=>input('카테고리 이름').props.onChange({target:{value:'개인용'}}));await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(input('카테고리 이름').props.value).toBe('개인용');mocks.context={state,coordinator,scopeKey:'other:user'};await act(async()=>renderer.update(<PackingPage/>));expect(renderer.root.findAllByProps({'aria-label':'카테고리 이름'})).toHaveLength(0);});
it('does not submit a Korean name while IME composition is active',async()=>{
  await mount();await act(async()=>button('카테고리 추가').props.onClick());
  const name=input('카테고리 이름');await act(async()=>name.props.onChange({target:{value:'여권'}}));
  name.props.onCompositionStart();
  const preventDefault=vi.fn();name.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:false},keyCode:229,preventDefault});
  expect(preventDefault).toHaveBeenCalledOnce();
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  expect(coordinator.execute).not.toHaveBeenCalled();
});
it('rejects an overlong raw name and permits a duplicate after correction',async()=>{
  await mount();await act(async()=>button('준비물 추가: 여권·예약·결제').props.onClick());
  await act(async()=>input('준비물 이름').props.onChange({target:{value:' '.repeat(100)+'x'}}));
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  expect(coordinator.execute).not.toHaveBeenCalled();expect(renderer.root.findAllByProps({role:'alert'})).toHaveLength(1);
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'여권'}}));
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'createItem',partId:1,name:'여권'});
});
it('keeps later name edits when an earlier save succeeds',async()=>{
  let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));await mount();
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'첫 번째 이름'}}));
  let pending!:Promise<void>;act(()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'두 번째 이름'}}));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(input('준비물 이름').props.value).toBe('두 번째 이름');
});
it('does not close a reopened name dialog when an old save resolves',async()=>{
  let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));await mount();
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  let pending!:Promise<void>;act(()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
  await act(async()=>button('취소').props.onClick());
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'새 초안'}}));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(input('준비물 이름').props.value).toBe('새 초안');
});
it('closes a name dialog if its target disappeared while saving',async()=>{
  coordinator.execute.mockResolvedValue({kind:'missing'});await mount();await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  expect(renderer.root.findAllByProps({'aria-label':'준비물 이름'})).toHaveLength(0);
});
it('opens item rename and category delete from their respective controls',async()=>{await mount();await act(async()=>button('준비물 이름 수정: 여권').props.onClick());expect(input('준비물 이름').props.value).toBe('여권');await act(async()=>button('취소').props.onClick());await act(async()=>button('카테고리 메뉴: 여권·예약·결제').props.onClick());await act(async()=>button('카테고리 삭제').props.onClick());expect(coordinator.prepareDelete).toHaveBeenCalledWith('part',1);});
it('requires a coordinator confirmation before deleting an item',async()=>{await mount();await act(async()=>button('준비물 삭제: 여권').props.onClick());expect(coordinator.prepareDelete).toHaveBeenCalledWith('item',11);expect(coordinator.confirmDelete).not.toHaveBeenCalled();state.confirmation={kind:'item',id:11,version:1,name:'여권'};await act(async()=>renderer.update(<PackingPage/>));await act(async()=>button('삭제').props.onClick());expect(coordinator.confirmDelete).toHaveBeenCalledOnce();});
it('saves the selected item memo without changing its checked state',async()=>{await mount();await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'새 메모'}}));await act(async()=>button('저장').props.onClick());expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:'새 메모'});expect(state.data!.parts[0].items[0].checked).toBe(false);});
it('keeps memo markup as text and sends blank memo save without deleting the item',async()=>{
  state.data!.parts[0].items[0]={...item,memo:{id:11,itemId:11,content:'<script>literal</script>'}};
  await mount();expect(renderer.root.findAllByType('script')).toHaveLength(0);
  await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'   '}}));
  await act(async()=>button('저장').props.onClick());
  expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:'   '});
  expect(renderer.root.findAllByProps({type:'checkbox'})).toHaveLength(2);
});
it('preserves newer memo typing when a pending save publishes the submitted text',async()=>{
  let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));await mount();
  const textarea=()=>renderer.root.findByType('textarea');
  await act(async()=>textarea().props.onChange({target:{value:'보낸 메모'}}));
  let pending!:Promise<void>;act(()=>{pending=button('저장').props.onClick();});
  await act(async()=>textarea().props.onChange({target:{value:'나중에 쓴 메모'}}));
  state.data!.parts[0].items[0]={...item,memo:{id:11,itemId:11,content:'보낸 메모'}};
  await act(async()=>renderer.update(<PackingPage/>));
  expect(textarea().props.value).toBe('나중에 쓴 메모');
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(textarea().props.value).toBe('나중에 쓴 메모');
});
it('preserves new memo typing when a pending memo deletion finishes',async()=>{
  let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));await mount();
  let pending!:Promise<void>;act(()=>{pending=button('메모 삭제: 여권').props.onClick();});
  await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'삭제 중 새 메모'}}));
  state.data!.parts[0].items[0]={...item,memo:null};
  await act(async()=>renderer.update(<PackingPage/>));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(renderer.root.findByType('textarea').props.value).toBe('삭제 중 새 메모');
});
it('preserves the loading state without fabricated progress or a list',async()=>{state.data=null;state.status='loading';await mount();expect(JSON.stringify(renderer.toJSON())).toContain('불러오는 중');expect(renderer.root.findAllByType('h2')).toHaveLength(0);expect(renderer.root.findAllByProps({'aria-label':'전체 준비 현황'})).toHaveLength(0);});
it('returns to the board when the selected item is removed',async()=>{await mount();await act(async()=>button('준비물 선택: 항공권 예약 내역').props.onClick());expect(renderer.root.findByProps({'aria-label':'준비물 상세'}).props['data-open']).toBe(true);state.data!.parts[0].items=[item];await act(async()=>renderer.update(<PackingPage/>));expect(renderer.root.findByProps({'aria-label':'준비물 상세'}).props['data-open']).toBe(false);});
it('opens a dismissible mobile detail sheet above the board',async()=>{
  await mount();await act(async()=>button('준비물 선택: 항공권 예약 내역').props.onClick());
  expect(renderer.root.findByProps({'aria-label':'준비물 상세'}).props['data-open']).toBe(true);
  await act(async()=>button('준비물 상세 닫기').props.onClick());
  expect(renderer.root.findByProps({'aria-label':'준비물 상세'}).props['data-open']).toBe(false);
});
