import { app, BrowserWindow, WebContentsView } from 'electron';

import { applicationMenuEvents } from './application-menu';
import { logger } from './logger';
import { sharedStorageEvents } from './shared-storage';
import { uiEvents } from './ui/events';
import { updaterEvents } from './updater/event';

export const allEvents = {
  applicationMenu: applicationMenuEvents,
  updater: updaterEvents,
  ui: uiEvents,
  sharedStorage: sharedStorageEvents,
};

function getActiveWindows() {
  return BrowserWindow.getAllWindows().filter(win => !win.isDestroyed());
}

export function registerEvents() {
  // register events
  for (const [namespace, namespaceEvents] of Object.entries(allEvents)) {
    for (const [key, eventRegister] of Object.entries(namespaceEvents)) {
      const subscription = eventRegister((...args: any[]) => {
        const chan = `${namespace}:${key}`;
        logger.debug(
          '[ipc-event]',
          chan,
          args.filter(
            a =>
              a !== undefined &&
              typeof a !== 'function' &&
              typeof a !== 'object'
          )
        );
        // is this efficient?
        getActiveWindows().forEach(win => {
          win.webContents.send(chan, ...args);
          win.contentView.children.forEach(child => {
            if (child instanceof WebContentsView) {
              child.webContents.send(chan, ...args);
            }
          });
        });
      });
      app.on('before-quit', () => {
        subscription();
      });
    }
  }
}
