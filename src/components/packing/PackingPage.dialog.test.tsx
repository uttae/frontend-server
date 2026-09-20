// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PackingPage } from './PackingPage';
const mocks = vi.hoisted(() => ({context:null as unknown}));
vi.mock('@/hooks/usePackingList',()=>({usePackingList:()=>mocks.context}));
vi.mock('sonner',()=>({toast:Object.assign(vi.fn(),{dismiss:vi.fn()})}));
afterEach(()=>{document.body.replaceChildren();vi.unstubAllGlobals();});
it('traps confirmation focus, handles Escape without deleting and restores main when opener disappears',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const state = {data:{id:1,roomId:'room',ownerUserId:1,version:1,initializedAt:'2026-01-01T00:00:00Z',parts:[]},status:'ready',message:null,undo:[],confirmation:{kind:'item',id:11,version:1,name:'여권'} as unknown};
  const cancelConfirmation=vi.fn();const confirmDelete=vi.fn();
  mocks.context={scopeKey:'room:1',state,coordinator:{cancelConfirmation,confirmDelete,refresh:vi.fn()}};
  const main=document.createElement('main');const opener=document.createElement('button');opener.textContent='원래 삭제 버튼';main.append(opener);document.body.append(main);opener.focus();
  const host=document.createElement('div');main.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<PackingPage/>));
    const dialog=document.querySelector('dialog')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const buttons=Array.from(dialog.querySelectorAll('button'));
    expect(document.activeElement).toBe(buttons[0]);
    buttons.at(-1)!.focus();
    const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));
    expect(document.activeElement).toBe(buttons.at(-1));
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(cancelConfirmation).toHaveBeenCalledOnce();
    expect(confirmDelete).not.toHaveBeenCalled();
    opener.remove();state.confirmation=null;
    await act(async()=>root.render(<PackingPage/>));
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(main);
    expect(main.hasAttribute('tabindex')).toBe(false);
    expect(main.hasAttribute('inert')).toBe(false);
  } finally {await act(async()=>root.unmount());}
});
