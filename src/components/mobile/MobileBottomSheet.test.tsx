// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileBottomSheet } from './MobileBottomSheet';

afterEach(() => vi.unstubAllGlobals());
it('dismisses by dragging the header, preserves controls and blocks dismissal while saving', () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 HTMLElement.prototype.setPointerCapture=vi.fn();
 HTMLElement.prototype.hasPointerCapture=()=>true;
 HTMLElement.prototype.releasePointerCapture=vi.fn();
 const host=document.createElement('div');const root=createRoot(host);const close=vi.fn();
 const render=(disabled=false,open=true)=>root.render(<MobileBottomSheet open={open} onClose={close} closeDisabled={disabled} title="일정 관리"><input aria-label="메모"/></MobileBottomSheet>);
 const pointer=(target:Element,type:string,y:number)=>{const event=new Event(type,{bubbles:true});Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:20,clientY:y});act(()=>target.dispatchEvent(event));};
 const drag=(target:Element,end='pointerup')=>{pointer(target,'pointerdown',20);pointer(target,'pointermove',150);pointer(target,end,150);};
 try {
  act(()=>render());
  drag(document.querySelector('h2')!);
  expect(close).toHaveBeenCalledTimes(1);
  close.mockClear();
  drag(document.querySelector('h2')!,'pointercancel');
  expect(close).not.toHaveBeenCalled();
  drag(document.querySelector('input')!);
  expect(close).not.toHaveBeenCalled();
  act(()=>render(true));drag(document.querySelector('h2')!);
  expect(close).not.toHaveBeenCalled();
  act(()=>render(false));pointer(document.querySelector('h2')!,'pointerdown',20);pointer(document.querySelector('h2')!,'pointermove',150);
  act(()=>render(false,false));act(()=>render());
  expect(document.querySelector('dialog')?.style.transform).toBe('');
 } finally {act(()=>root.unmount());host.remove();}
});
