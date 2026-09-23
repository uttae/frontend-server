// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';

const css = readFileSync('src/components/packing/PackingPage.module.css', 'utf8');
type Capabilities = { hover: 'hover' | 'none'; pointer: 'fine' | 'coarse' | 'none'; anyPointer: 'fine' | 'coarse' | 'none' };
const noPointer: Capabilities = { hover: 'none', pointer: 'none', anyPointer: 'none' };

// jsdom does not evaluate device media or interactive pseudo-classes. Select the
// actual stylesheet's media rules for each capability fixture, then use its CSS
// engine for the cascade. data attributes stand in only for hover/focus states;
// actual browser interaction and geometry remain a Hermes acceptance check.
function mountStyles(capabilities: Capabilities) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const activeRules = [...style.sheet!.cssRules].flatMap(rule => {
    if (!(rule instanceof CSSMediaRule)) return [rule.cssText];
    const matches = [...rule.conditionText.matchAll(/\(([\w-]+):\s*([\w-]+)\)/g)].every(([, feature, value]) => {
      if (feature === 'min-width') return 1440 >= Number.parseInt(value);
      if (feature === 'max-width') return 1440 <= Number.parseInt(value);
      if (feature === 'hover') return capabilities.hover === value;
      if (feature === 'pointer') return capabilities.pointer === value;
      if (feature === 'any-pointer') return capabilities.anyPointer === value;
      throw new Error(`Unsupported media feature: ${feature}`);
    });
    return matches ? [...rule.cssRules].map(child => child.cssText) : [];
  });
  style.textContent = activeRules.join('\n').replaceAll(':hover', '[data-hover]').replaceAll(':focus-within', '[data-focus-within]');
  document.body.innerHTML = '<div class="partHeader"><div class="partActions"><button>Rename part</button></div></div><div class="itemRow"><button class="itemRename">Rename item</button></div>';
  return ['.partActions', '.itemRename'].map(selector => document.querySelector<HTMLElement>(selector)!);
}
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); });

it.each([
  ['no advertised pointer', noPointer],
  ['fine pointer', { hover: 'hover', pointer: 'fine', anyPointer: 'fine' }],
] as const)('keeps optional desktop actions undisclosed with %s', (_name, capabilities) => {
  for (const action of mountStyles(capabilities)) {
    const computed = getComputedStyle(action);
    expect(computed.opacity || '1').toBe('0');
    expect(computed.pointerEvents).toBe('none');
    expect(computed.display).not.toBe('none');
    expect(computed.visibility).not.toBe('hidden');
  }
});

it.each(['hover', 'focus-within'])('reveals optional actions on %s even without advertised pointer capabilities', state => {
  for (const action of mountStyles(noPointer)) {
    action.parentElement!.setAttribute(`data-${state}`, '');
    const computed = getComputedStyle(action);
    expect(computed.opacity || '1').toBe('1');
    expect(computed.pointerEvents).toBe('auto');
  }
});

it.each([
  ['touch', { hover: 'none', pointer: 'coarse', anyPointer: 'coarse' }],
  ['hybrid touch and mouse', { hover: 'hover', pointer: 'fine', anyPointer: 'coarse' }],
] as const)('keeps optional actions directly available for %s', (_name, capabilities) => {
  for (const action of mountStyles(capabilities)) {
    const computed = getComputedStyle(action);
    expect(computed.opacity || '1').toBe('1');
    expect(computed.pointerEvents || 'auto').toBe('auto');
  }
});
