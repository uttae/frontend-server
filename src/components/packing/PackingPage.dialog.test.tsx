// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {PackingPage} from './PackingPage';
const mocks=vi.hoisted(()=>({context:null as unknown}));
vi.mock('@/hooks/usePackingList',()=>({usePackingList:()=>mocks.context}));
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
it('traps category dialog focus, closes with Escape, and restores its opener',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  mocks.context={scopeKey:'room:user',state:{data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[]},status:'ready',message:null,confirmation:null},coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const opener=main.querySelector<HTMLButtonElement>('button')!;opener.focus();
    await act(async()=>opener.click());
    const dialog=document.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(main.hasAttribute('inert')).toBe(true);
    const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input'));
    expect(document.activeElement).toBe(controls[0]);
    controls.at(-1)!.focus();
    const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);expect(document.activeElement).toBe(controls[0]);
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(document.querySelector('dialog')).toBeNull();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  }finally{await act(async()=>root.unmount());}
});
it('returns focus to the category menu trigger after closing a menu dialog',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  mocks.context={scopeKey:'room:user',state:{data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[]}]},status:'ready',message:null,confirmation:null},coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const trigger=main.querySelector<HTMLButtonElement>('[aria-label="카테고리 메뉴: 여권·예약·결제"]')!;
    await act(async()=>trigger.click());
    let rename=main.querySelector<HTMLButtonElement>('[role="menuitem"]:nth-child(2)')!;
    rename.focus();await act(async()=>rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(main.querySelector('[role="menu"]')).toBeNull();expect(document.activeElement).toBe(trigger);
    await act(async()=>trigger.click());
    rename=main.querySelector<HTMLButtonElement>('[role="menuitem"]:nth-child(2)')!;
    rename.focus();await act(async()=>rename.click());
    expect(document.querySelector('dialog')).not.toBeNull();
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(document.activeElement).toBe(trigger);
  }finally{await act(async()=>root.unmount());}
});
it('does not cancel a delete confirmation after its request has started',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  let finish!:(value:{kind:string})=>void;
  const confirmDelete=vi.fn(()=>new Promise<{kind:string}>(resolve=>{finish=resolve;}));
  const cancelConfirmation=vi.fn();
  const state={data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[{id:1,name:'여권·예약·결제',column:0,position:0,items:[{id:11,partId:1,name:'여권',checked:false,position:0,memo:null,tips:[]}]}]},status:'ready',message:null,confirmation:{kind:'item',id:11,version:1,name:'여권'} as {kind:'item';id:number;version:number;name:string}|null};
  mocks.context={scopeKey:'room:user',state,coordinator:{execute:vi.fn(),prepareDelete:vi.fn(),confirmDelete,cancelConfirmation,refresh:vi.fn()}};
  const main=document.createElement('main');document.body.append(main);const root=createRoot(main);
  try{
    await act(async()=>root.render(<PackingPage/>));
    const dialog=document.querySelector('dialog')!;
    const action=Array.from(dialog.querySelectorAll('button')).find(button=>button.textContent==='삭제')!;
    await act(async()=>action.click());
    const cancel=Array.from(dialog.querySelectorAll('button')).find(button=>button.textContent==='취소')!;
    expect(cancel.disabled).toBe(true);
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(cancelConfirmation).not.toHaveBeenCalled();
    await act(async()=>{finish({kind:'success'});state.confirmation=null;root.render(<PackingPage/>);});
  }finally{await act(async()=>root.unmount());}
});
