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
    const rename=main.querySelector<HTMLButtonElement>('[role="menuitem"]:nth-child(2)')!;
    rename.focus();await act(async()=>rename.click());
    expect(document.querySelector('dialog')).not.toBeNull();
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(document.activeElement).toBe(trigger);
  }finally{await act(async()=>root.unmount());}
});
