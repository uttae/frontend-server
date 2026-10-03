import { readIsMobileDevice } from "./device";

export type MobileViewState = {
  isMobileDevice: boolean;
};

export function readMobileViewState(): MobileViewState {
  const isMobileDevice = readIsMobileDevice();
  return {
    isMobileDevice,
  };
}

export const MOBILE_VIEW_DEFAULT: MobileViewState = {
  isMobileDevice: false,
};
