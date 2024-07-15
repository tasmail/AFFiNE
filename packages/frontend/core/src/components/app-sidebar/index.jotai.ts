import { atom } from 'jotai';

export const APP_SIDEBAR_OPEN = 'app-sidebar-open';
export const isMobile = window.innerWidth < 768;

export const appSidebarFloatingAtom = atom(isMobile);
export const appSidebarResizingAtom = atom(false);
