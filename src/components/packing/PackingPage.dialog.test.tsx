// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {PackingPage} from './PackingPage';
const mocks=vi.hoisted(()=>({context:null as unknown}));
vi.mock('@/hooks/usePackingList',()=>({usePackingList:()=>mocks.context}));
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
// Base UI는 첫 포커스·포커스 복귀를 다음 프레임에, 닫힘 정리(언마운트)를 애니메이션 확인 뒤에 한다
const settle=()=>act(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>resolve(null)));await new Promise(resolve=>setTimeout(resolve,0));});
const escape=(target:EventTarget=document)=>act(async()=>{target.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));});
function accessibleName(node:Element){
  const labelledBy=node.getAttribute('aria-labelledby');
  if(labelledBy) return labelledBy.split(' ').map(id=>document.getElementById(id)?.textContent ?? '').join(' ');
  return node.getAttribute('aria-label') ?? node.textContent ?? '';
}
const buttonIn=(scope:ParentNode,name:string)=>Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(node=>accessibleName(node)===name)!;
const openDialog=()=>document.querySelector<HTMLElement>('[role="dialog"][data-open]');
const openAlert=()=>document.querySelector<HTMLElement>('[role="alertdialog"][data-open]');
const deleteState=(status='ready')=>({data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[{id:11,partId:1,name:'여권',checked:false,position:0,memo:null,tips:[]}]}]},status,message:null,confirmation:{kind:'item',id:11,version:1,name:'여권'} as {kind:'item';id:number;version:number;name:string}|null});
it('opens the category dialog as a modal, closes with Escape, and restores its opener',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  mocks.context={scopeKey:'room:user',state:{data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[]},status:'ready',message:null,confirmation:null},coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const opener=main.querySelector<HTMLButtonElement>('[aria-label="카테고리 추가"]')!;opener.focus();
    await act(async()=>opener.click());
    await settle();
    const dialog=openDialog()!;
    expect(dialog).not.toBeNull();
    expect(accessibleName(dialog)).toBe('카테고리 추가');
    // 바깥 페이지는 Base UI가 aria-hidden으로 가리고, 첫 포커스는 첫 입력 칸이다
    expect(main.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(dialog.querySelector('input[aria-label="카테고리 이름"]'));
    // 닫기 X는 없다(취소·추가만)
    expect(Array.from(dialog.querySelectorAll('button')).map(accessibleName)).toEqual(['취소','추가']);
    await escape();
    await settle();
    expect(openDialog()).toBeNull();
    expect(main.hasAttribute('aria-hidden')).toBe(false);
    expect(document.activeElement).toBe(opener);
  }finally{await act(async()=>root.unmount());}
});
it('returns focus to the category menu trigger after closing a menu dialog',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  mocks.context={scopeKey:'room:user',state:{data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[]}]},status:'ready',message:null,confirmation:null},coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  const menu=()=>document.querySelector<HTMLElement>('[role="menu"]');
  const rename=()=>document.querySelector<HTMLElement>('[role="menuitem"][aria-label="카테고리 이름 수정"]')!;
  try{
    await act(async()=>root.render(<PackingPage/>));
    const trigger=main.querySelector<HTMLButtonElement>('[aria-label="카테고리 메뉴: 여권·예약·결제"]')!;
    trigger.focus();
    await act(async()=>trigger.click());
    await settle();
    expect(Array.from(document.querySelectorAll('[role="menuitem"]')).map(node=>node.getAttribute('aria-label'))).toEqual(['준비물 추가','카테고리 이름 수정','카테고리 삭제']);
    rename().focus();await escape(rename());
    await settle();
    expect(menu()).toBeNull();expect(document.activeElement).toBe(trigger);
    await act(async()=>trigger.click());
    await settle();
    rename().focus();await act(async()=>rename().click());
    await settle();
    expect(openDialog()).not.toBeNull();
    expect(menu()).toBeNull();
    expect((openDialog()!.querySelector('input[aria-label="카테고리 이름"]') as HTMLInputElement).value).toBe('여권·예약·결제');
    await escape();
    await settle();
    expect(openDialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  }finally{await act(async()=>root.unmount());}
});
it('does not cancel a delete confirmation after its request has started',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  let finish!:(value:{kind:string})=>void;
  const confirmDelete=vi.fn(()=>new Promise<{kind:string}>(resolve=>{finish=resolve;}));
  const cancelConfirmation=vi.fn();
  const state=deleteState();
  mocks.context={scopeKey:'room:user',state,coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),confirmDelete,cancelConfirmation,refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const dialog=openAlert()!;
    expect(dialog.textContent).toContain('준비물을 삭제할까요?');
    await act(async()=>buttonIn(dialog,'삭제').click());
    expect(confirmDelete).toHaveBeenCalledOnce();
    // 삭제 중: 확인 버튼은 progress, 취소는 비활성, Esc·딤으로 닫히지 않는다
    expect(buttonIn(dialog,'처리 중').getAttribute('aria-busy')).toBe('true');
    expect(buttonIn(dialog,'취소').disabled).toBe(true);
    await escape();
    await act(async()=>buttonIn(document,'준비물을 삭제할까요? 배경 닫기').click());
    expect(cancelConfirmation).not.toHaveBeenCalled();
    expect(openAlert()).not.toBeNull();
    await act(async()=>{finish({kind:'success'});state.confirmation=null;root.render(<PackingPage/>);});
  }finally{await act(async()=>root.unmount());}
});
it.each(['writing','sync-error'])('disables the delete confirmation while the list status is %s',async status=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const confirmDelete=vi.fn();
  const cancelConfirmation=vi.fn();
  mocks.context={scopeKey:'room:user',state:deleteState(status),coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),confirmDelete,cancelConfirmation,refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const dialog=openAlert()!;
    const action=buttonIn(dialog,'삭제');
    expect(action.disabled).toBe(true);
    await act(async()=>action.click());
    expect(confirmDelete).not.toHaveBeenCalled();
    // 취소는 그대로 된다
    await act(async()=>buttonIn(dialog,'취소').click());
    expect(cancelConfirmation).toHaveBeenCalledOnce();
  }finally{await act(async()=>root.unmount());}
});
