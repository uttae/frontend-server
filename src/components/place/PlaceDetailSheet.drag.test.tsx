// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PlaceDetailSheet } from './PlaceDetailSheet';
it('dismisses a collapsed sheet, but cancels safely and collapses an expanded sheet first', () => {
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 vi.stubGlobal('ResizeObserver',class {observe() {} disconnect() {}});
 HTMLElement.prototype.scrollTo=vi.fn();
 const host=document.createElement('div');const root=createRoot(host);const close=vi.fn();
 const touch=(target:Element,type:string,y:number)=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.assign(event,{touches:[{clientY:y}]});act(()=>target.dispatchEvent(event));};
 try {
  act(()=>root.render(<PlaceDetailSheet placeKey="one" onBack={()=>{}} onClose={close} peek={<p>장소 정보</p>}><p>상세 정보</p></PlaceDetailSheet>));
  const header=host.querySelector('button')!.parentElement!;
  touch(header,'touchstart',20);touch(header,'touchmove',150);touch(header,'touchcancel',150);
  expect(close).not.toHaveBeenCalled();
  act(()=>host.firstElementChild!.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:100})));
  touch(header,'touchstart',20);touch(header,'touchmove',150);touch(header,'touchend',150);
  expect(close).not.toHaveBeenCalled();
  touch(header,'touchstart',20);touch(header,'touchmove',150);touch(header,'touchend',150);
  expect(close).toHaveBeenCalledTimes(1);
 } finally {act(()=>root.unmount());vi.unstubAllGlobals();}
});
