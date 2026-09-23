// @vitest-environment jsdom
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { PackingPage } from './PackingPage';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PackingItem } from '@/lib/packing/types';
import type { ReactNode } from 'react';
vi.mock('@/components/settings/SettingsDialog', () => ({SettingsDialog: ({title,onClose,children}: {title:string;onClose:()=>void;children:ReactNode}) => <dialog aria-label={title} onCancel={onClose}>{children}</dialog>}));
const mocks = vi.hoisted(() => ({ context: null as unknown, toast: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/hooks/usePackingList', () => ({ usePackingList: () => mocks.context }));
vi.mock('sonner', () => ({ toast: Object.assign(mocks.toast, { dismiss: mocks.dismiss }) }));
let renderer: ReactTestRenderer;
const item: PackingItem = { id: 11, partId: 1, name: '여권', checked: false, position: 0, memo: null };
const data = { id: 1, roomId: 'room', ownerUserId: 1, version: 1, initializedAt: '2026-01-01T00:00:00Z', parts: [ { id: 1, name: '서류', column: 0, position: 0, items: [item] }, { id: 2, name: '가방', column: 1, position: 1, items: [] } ] };
let state: { data: typeof data | null; status: string; message: string | null; confirmation: unknown; undo: unknown[] };
let coordinator: { execute: ReturnType<typeof vi.fn>; refresh: ReturnType<typeof vi.fn>; prepareDelete: ReturnType<typeof vi.fn>; confirmDelete: ReturnType<typeof vi.fn>; cancelConfirmation: ReturnType<typeof vi.fn>; restore: ReturnType<typeof vi.fn> };
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.clearAllMocks(); state = {data: structuredClone(data), status: 'ready', message: null, confirmation: null, undo: []}; coordinator = { execute: vi.fn().mockResolvedValue({kind:'success'}), refresh: vi.fn(), prepareDelete: vi.fn(), confirmDelete: vi.fn(), cancelConfirmation: vi.fn(), restore: vi.fn() }; mocks.context = { state, coordinator, scopeKey:'room:user' }; });
afterEach(() => { if(renderer) act(() => renderer.unmount()); vi.unstubAllGlobals(); });
async function mount() { await act(async () => { renderer = create(<PackingPage />); }); }
function button(label: string) { return renderer.root.findAllByType('button').find(n => n.props['aria-label'] === label || n.children.join('') === label)!; }
function input(label: string) { return renderer.root.findAllByType('input').find(n => n.props['aria-label'] === label)!; }
it('renders only authoritative data and first-only expansion without fabricated progress', async () => { await mount(); expect(renderer.root.findAllByProps({'aria-expanded':true})).toHaveLength(1); expect(renderer.root.findAllByProps({'aria-expanded':false})).toHaveLength(1); expect(renderer.root.findByProps({'aria-label':'전체 준비 현황'}).children.join('')).toBe('0 / 1개 준비 완료'); });
it('does not show a false empty list while loading', async () => { state.data = null; state.status = 'loading'; await mount(); expect(JSON.stringify(renderer.toJSON())).toContain('불러오는 중'); expect(renderer.root.findAllByType('input')).toHaveLength(0); });
it('keeps drafts editable while writes are blocked, and preserves failed drafts', async () => { await mount(); await act(async () => button('준비물 추가: 서류').props.onClick()); await act(async () => input('새 준비물 이름').props.onChange({target:{value:'약'}})); state.status = 'writing'; await act(async () => renderer.update(<PackingPage />)); expect(input('새 준비물 이름').props.disabled).toBeUndefined(); expect(button('추가').props.disabled).toBe(true); state.status='ready'; coordinator.execute.mockResolvedValue({kind:'error'}); await act(async () => renderer.update(<PackingPage />)); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(input('새 준비물 이름').props.value).toBe('약'); });
it('sends desired checkbox value with stable ID and delegates deletion', async () => { await mount(); await act(async () => renderer.root.findByProps({type:'checkbox'}).props.onChange({target:{checked:true}})); expect(coordinator.execute).toHaveBeenCalledWith({type:'checkItem',id:11,checked:true}); await act(async () => button('준비물 삭제: 여권').props.onClick({currentTarget:document.createElement('button')})); expect(coordinator.prepareDelete).toHaveBeenCalledWith('item',11); });
it('keeps expansion after refetch and does not auto-open after first deletion', async () => { await mount(); state.data = {...data,parts:[data.parts[1]]}; await act(async () => renderer.update(<PackingPage />)); expect(renderer.root.findAllByProps({'aria-expanded':true})).toHaveLength(0); });
it('clears drafts on scope change', async () => { await mount(); await act(async () => button('준비물 추가: 서류').props.onClick()); await act(async () => input('새 준비물 이름').props.onChange({target:{value:'private'}})); mocks.context = {state,coordinator,scopeKey:'room:other'}; await act(async () => renderer.update(<PackingPage />)); expect(renderer.root.findAllByProps({'aria-label':'새 준비물 이름'})).toHaveLength(0); });
it('shows a larger undo toast with the supplied arrow and retains the undo action', async () => {
  state.undo = [{id:11,name:'여권',remainingMs:9000}];
  await mount();
  expect(mocks.toast).toHaveBeenCalledWith('여권 삭제됨', expect.objectContaining({duration:9000}));
  const options = mocks.toast.mock.calls[0][1];
  expect(options.style.minHeight).toBeGreaterThanOrEqual(72);
  expect(options.style.width).toBeUndefined();
  expect(options.actionButtonStyle.height).toBeGreaterThanOrEqual(36);
  const action = options.action;
  const label = renderToStaticMarkup(action.label);
  expect(label).toContain('실행 취소');
  expect(label).toContain('width="24" height="24"');
  expect(label).toContain('viewBox="0 0 24 24"');
  expect(label).toContain('M9 14L5 10L9 6');
  expect(label).toContain('M5 10H16C17.0609 10');
  expect(label).toContain('stroke="#3B3F4E"');
  expect(label).toContain('aria-hidden="true"');
  await act(async () => action.onClick());
  expect(coordinator.restore).toHaveBeenCalledWith(11);
  state.undo = [];
  await act(async () => renderer.update(<PackingPage />));
  expect(mocks.dismiss).toHaveBeenCalled();
});
it('renders memo as plain text with safe links and saves blank memo without deleting item', async () => { state.data!.parts[0].items[0] = {...item,memo:{id:11,itemId:11,content:'<script>literal</script> https://example.com'}}; await mount(); const link=renderer.root.findByType('a'); expect(link.props.target).toBe('_blank'); expect(link.props.rel).toBe('noopener noreferrer'); const stop=vi.fn(); link.props.onClick({stopPropagation:stop}); expect(stop).toHaveBeenCalledOnce(); expect(renderer.root.findAllByType('script')).toHaveLength(0); await act(async () => button('메모').props.onClick()); const textarea=renderer.root.findByType('textarea'); await act(async () => textarea.props.onChange({target:{value:'   '}})); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:'   '}); expect(renderer.root.findAllByProps({type:'checkbox'})).toHaveLength(1); });
it('prevents IME submission and allows Escape cancellation', async () => { await mount(); await act(async () => button('준비물 추가: 서류').props.onClick()); await act(async () => input('새 준비물 이름').props.onChange({target:{value:'약'}})); const form=renderer.root.findByType('form'); const preventDefault=vi.fn(); form.props.onKeyDown({key:'Enter',nativeEvent:{isComposing:true},preventDefault}); expect(preventDefault).toHaveBeenCalledOnce(); input('새 준비물 이름').props.onCompositionStart(); await act(async () => form.props.onSubmit({preventDefault(){}})); expect(coordinator.execute).not.toHaveBeenCalled(); await act(async () => form.props.onKeyDown({key:'Escape',stopPropagation(){},nativeEvent:{}})); expect(renderer.root.findAllByType('form')).toHaveLength(0); });
it('validates raw length before submitting and permits duplicate names', async () => { await mount(); await act(async () => button('준비물 추가: 서류').props.onClick()); await act(async () => input('새 준비물 이름').props.onChange({target:{value:' '.repeat(100)+'x'}})); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(coordinator.execute).not.toHaveBeenCalled(); expect(renderer.root.findAllByProps({role:'alert'})).toHaveLength(1); await act(async () => input('새 준비물 이름').props.onChange({target:{value:'여권'}})); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(coordinator.execute).toHaveBeenCalledWith({type:'createItem',partId:1,name:'여권'}); });
it('opens created part and keeps other expansion choices', async () => { await mount(); coordinator.execute.mockImplementation(async () => {state.data={...data,parts:[...data.parts,{id:3,name:'약',column:2,position:2,items:[]}]};return {kind:'success',createdPartId:3};}); await act(async () => button('+ 파트 추가').props.onClick()); await act(async () => input('새 파트 이름').props.onChange({target:{value:'약'}})); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); await act(async () => renderer.update(<PackingPage />)); expect(renderer.root.findAllByProps({'aria-expanded':true})).toHaveLength(2); });
it('clears editor after target404 and preserves it on conflict', async () => { await mount(); await act(async () => button('준비물 이름 수정: 여권').props.onClick()); coordinator.execute.mockResolvedValue({kind:'error'}); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(input('준비물 이름')).toBeDefined(); coordinator.execute.mockResolvedValue({kind:'missing'}); await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}})); expect(renderer.root.findAllByType('form')).toHaveLength(0); });
it('reuses the shared accessible dialog and cancellation sends no delete', async () => { state.confirmation={kind:'item',id:11,version:1,name:'여권'}; await mount(); const dialog=renderer.root.findByType('dialog'); expect(dialog.props['aria-label']).toBe('준비물 삭제'); await act(async () => dialog.props.onCancel()); expect(coordinator.cancelConfirmation).toHaveBeenCalledOnce(); expect(coordinator.confirmDelete).not.toHaveBeenCalled(); });

it('preserves text entered during a successful pending save', async () => { let finish!:(value:{kind:string})=>void;coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));await mount();await act(async()=>button('준비물 이름 수정: 여권').props.onClick());await act(async()=>input('준비물 이름').props.onChange({target:{value:'여권 1'}}));let pending:Promise<void>;act(()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});await act(async()=>input('준비물 이름').props.onChange({target:{value:'여권 2'}}));await act(async()=>{finish({kind:'success'});await pending;});expect(input('준비물 이름')?.props.value).toBe('여권 2'); });

const approvedSeed = [
  { name: '여권·서류', column: 0, names: ['여권', '여권 사본·스캔본', '항공권 예약 내역', '숙소 예약 내역·주소', '여행자보험 증서'] },
  { name: '돈·결제수단', column: 0, names: ['해외 결제 카드', '예비 카드', '현지에서 사용할 현금', '지갑', '카드 분실 신고 연락처'] },
  { name: '전자기기', column: 0, names: ['휴대폰', '충전기', '충전 케이블', '보조배터리', '이어폰'] },
  { name: '의류·가방', column: 1, names: ['상의·하의', '속옷·양말', '잠옷·겉옷', '편한 신발', '여행가방·작은 가방'] },
  { name: '세면·위생', column: 1, names: ['칫솔·치약', '세안제·보습제', '자외선차단제', '휴지·물티슈·손 소독제', '파우치·투명 지퍼백'] },
  { name: '개인 준비물', column: 1, names: ['복용약·처방 서류', '상비약·밴드', '안경·렌즈·세척액', '생리용품·면도기', '샴푸·수건'] },
  { name: '여행 조건별 준비물', column: 2, names: ['비자·입국 관련 서류', '변환 플러그·어댑터', '우산·우비·방한용품', '모자·수영복·벌레기피제', '운전 서류·유아용품·목베개'] },
  { name: '출국 전 할 일', column: 2, names: ['여권·입국 요건 확인', '해외 통신수단 준비', '결제·환전·보험 준비', '예약·비상정보 백업', '수하물·반입 규정 확인'] },
];
function approvedResponse() {
  return {...data, parts: approvedSeed.map((part, position) => ({
    id: position + 1, name: part.name, column: part.column, position,
    items: part.names.map((name, index) => ({id: position * 5 + index + 101, partId: position + 1, name, checked: false, position: index, memo: null})),
  }))};
}
it('renders the exact authoritative 8-part/40-item initial response in 3/3/2 columns', async () => {
  state.data = approvedResponse();
  await mount();
  expect(renderer.root.findAllByType('h2').map(node => node.children.join(''))).toEqual(approvedSeed.map(part => part.name));
  const checkboxes = renderer.root.findAllByProps({type:'checkbox'});
  expect(checkboxes).toHaveLength(40);
  expect(checkboxes.every(node => node.props.checked === false)).toBe(true);
  expect(checkboxes.map(node => node.props['aria-label'])).toEqual(approvedSeed.flatMap(part => part.names.map(name => `${name} 준비 완료`)));
  expect(renderer.root.findByProps({'aria-label':'전체 준비 현황'}).children.join('')).toBe('0 / 40개 준비 완료');
  expect(renderer.root.findAllByType('button').filter(node => node.children.join('') === '+ 메모')).toHaveLength(40);
  expect(renderer.root.findAllByType('button').filter(node => node.children.join('') === '메모')).toHaveLength(0);
  expect(renderer.root.findAllByType('textarea')).toHaveLength(0);
  expect(renderer.root.findAllByProps({className:'min-w-0 space-y-6'}).map(column => column.findAllByType('section').length)).toEqual([3,3,2]);
});
it('uses backend column/position rather than array order or a client seed', async () => {
  const response = approvedResponse();
  response.parts[0].position = 2;
  response.parts[2].position = 0;
  response.parts[0].items[0].position = 4;
  response.parts[0].items[4].position = 0;
  response.parts.reverse();
  response.parts.forEach(part => part.items.reverse());
  state.data = response;
  await mount();
  expect(renderer.root.findAllByType('h2').map(node => node.children.join(''))).toEqual([
    '전자기기','돈·결제수단','여권·서류','의류·가방','세면·위생','개인 준비물','여행 조건별 준비물','출국 전 할 일',
  ]);
  const documentPart = renderer.root.findAllByType('section').find(section => section.findByType('h2').children.join('') === '여권·서류')!;
  expect(documentPart.findAllByProps({type:'checkbox'}).map(node => node.props['aria-label'])).toEqual([
    '여행자보험 증서 준비 완료','여권 사본·스캔본 준비 완료','항공권 예약 내역 준비 완료','숙소 예약 내역·주소 준비 완료','여권 준비 완료',
  ]);
});
it('renders a 2000-code-unit memo and long URL safely, and blank save keeps the checked item', async () => {
  const prefix = '<script>alert(1)</script>\n';
  const url = `https://example.com/${'a'.repeat(2000 - prefix.length - 'https://example.com/'.length)}`;
  const content = prefix + url;
  expect(content.length).toBe(2000);
  state.data!.parts[0].items[0] = {...item, checked:true, memo:{id:11,itemId:11,content}};
  await mount();
  const link = renderer.root.findByType('a');
  expect(link.props.href).toBe(url);
  expect(link.props.target).toBe('_blank');
  expect(link.props.rel).toBe('noopener noreferrer');
  expect(renderer.root.findAllByType('script')).toHaveLength(0);
  expect(link.props.className).toContain('[overflow-wrap:anywhere]');
  expect(renderer.root.findAll(node => node.props.dangerouslySetInnerHTML !== undefined)).toHaveLength(0);
  await act(async () => button('메모').props.onClick());
  expect(renderer.root.findByType('textarea').props.value).toBe(content);
  coordinator.execute.mockImplementation(async () => {
    state.data!.parts[0].items[0] = {...item,checked:true,memo:null};
    return {kind:'success'};
  });
  await act(async () => renderer.root.findByType('textarea').props.onChange({target:{value:' \r\n\t '}}));
  await act(async () => renderer.root.findByType('form').props.onSubmit({preventDefault(){}}));
  await act(async () => renderer.update(<PackingPage />));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'saveMemo',id:11,content:' \r\n\t '});
  expect(renderer.root.findByProps({type:'checkbox'}).props.checked).toBe(true);
  expect(button('+ 메모')).toBeDefined();
  expect(renderer.root.findAllByType('a')).toHaveLength(0);
});
it('does not let a cancelled pending save close a reopened editor', async () => {
  let finish!:(value:{kind:string})=>void;
  coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  await mount();
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  let pending:Promise<void>;
  act(()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
  await act(async()=>button('취소').props.onClick());
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'새 초안'}}));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(input('준비물 이름')?.props.value).toBe('새 초안');
});
it('does not let a pending rename close a newly opened memo editor', async () => {
  let finish!:(value:{kind:string})=>void;
  coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  await mount();
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  let pending:Promise<void>;
  act(()=>{pending=renderer.root.findByType('form').props.onSubmit({preventDefault(){}});});
  await act(async()=>button('+ 메모').props.onClick());
  await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'메모 초안'}}));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(renderer.root.findByType('textarea').props.value).toBe('메모 초안');
});
it('does not let pending memo deletion close a replacement name editor', async () => {
  state.data!.parts[0].items[0] = {...item,memo:{id:11,itemId:11,content:'saved'}};
  let finish!:(value:{kind:string})=>void;
  coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  await mount();await act(async()=>button('메모').props.onClick());
  let pending:Promise<void>;act(()=>{pending=button('메모 삭제').props.onClick();});
  await act(async()=>button('준비물 이름 수정: 여권').props.onClick());
  await act(async()=>input('준비물 이름').props.onChange({target:{value:'새 이름'}}));
  await act(async()=>{finish({kind:'success'});await pending;});
  expect(input('준비물 이름')?.props.value).toBe('새 이름');
});
it('preserves memo text typed during pending deletion', async () => {
  state.data!.parts[0].items[0] = {...item,memo:{id:11,itemId:11,content:'saved'}};
  let finish!:(value:{kind:string})=>void;
  coordinator.execute.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  await mount();await act(async()=>button('메모').props.onClick());
  let pending:Promise<void>;act(()=>{pending=button('메모 삭제').props.onClick();});
  await act(async()=>renderer.root.findByType('textarea').props.onChange({target:{value:'새 메모'}}));
  await act(async()=>{state.data!.parts[0].items[0]={...item,memo:null};finish({kind:'success'});await pending;renderer.update(<PackingPage/>);});
  expect(renderer.root.findByType('textarea').props.value).toBe('새 메모');
});
it('closes unchanged memo editor after confirmed deletion', async () => {
  state.data!.parts[0].items[0] = {...item,memo:{id:11,itemId:11,content:'saved'}};
  coordinator.execute.mockImplementation(async()=>{state.data!.parts[0].items[0]={...item,memo:null};return {kind:'success'};});
  await mount();await act(async()=>button('메모').props.onClick());
  await act(async()=>button('메모 삭제').props.onClick());
  await act(async()=>renderer.update(<PackingPage/>));
  expect(renderer.root.findAllByType('textarea')).toHaveLength(0);
  expect(button('+ 메모')).toBeDefined();
});


it('shows authoritative part progress beside each heading and updates checked totals', async () => {
  await mount();
  expect(renderer.root.findByType('h1').children.join('')).toBe('준비물 체크리스트');
  expect(renderer.root.findByProps({'aria-label':'서류 준비 현황'}).children.join('')).toBe('0 / 1');
  expect(renderer.root.findByProps({'aria-label':'가방 준비 현황'}).children.join('')).toBe('0 / 0');
  expect(button('새로고침')).toBeUndefined();
  state.data!.parts[0].items[0].checked = true;
  await act(async () => renderer.update(<PackingPage />));
  expect(renderer.root.findByProps({'aria-label':'서류 준비 현황'}).children.join('')).toBe('1 / 1');
  expect(renderer.root.findByProps({'aria-label':'전체 준비 현황'}).children.join('')).toBe('1 / 1개 준비 완료');
});

it('opens a collapsed part when its header add action starts an inline draft', async () => {
  await mount();
  const add = button('준비물 추가: 가방');
  expect(add.children.join('')).toBe('+ 추가');
  await act(async () => add.props.onClick());
  expect(button('가방 펼치기 또는 접기').props['aria-expanded']).toBe(true);
  expect(input('새 준비물 이름')).toBeDefined();
  expect(button('서류 펼치기 또는 접기').props['aria-expanded']).toBe(true);
  await act(async () => button('취소').props.onClick());
  expect(renderer.root.findAllByType('form')).toHaveLength(0);
});

it('keeps compact rename and delete actions accessible without repeated text labels', async () => {
  await mount();
  for (const label of ['준비물 이름 수정: 여권', '파트 이름 수정: 서류', '파트 삭제: 서류']) {
    expect(button(label)).toBeDefined();
    expect(button(label).children.join('')).not.toMatch(/수정|삭제/);
  }
  expect(button('준비물 삭제: 여권').children.join('')).not.toContain('삭제');
  await act(async () => button('파트 이름 수정: 서류').props.onClick());
  expect(input('파트 이름').props.value).toBe('서류');
  await act(async () => button('취소').props.onClick());
  await act(async () => button('파트 삭제: 서류').props.onClick({currentTarget:document.createElement('button')}));
  expect(coordinator.prepareDelete).toHaveBeenCalledWith('part', 1);
});

it('deletes a saved memo from its compact action without deleting the item', async () => {
  coordinator.execute.mockReturnValue(new Promise(() => {}));
  state.data!.parts[0].items[0] = {...item,memo:{id:11,itemId:11,content:'saved'}};
  await mount();
  await act(async () => button('메모 삭제: 여권').props.onClick({currentTarget: {isConnected:true}}));
  expect(coordinator.execute).toHaveBeenCalledWith({type:'deleteMemo',id:11});
  expect(coordinator.prepareDelete).not.toHaveBeenCalled();
});
