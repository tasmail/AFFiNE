import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import {
  app,
  type CookiesSetDetails,
  Menu,
  type Rectangle,
  type View,
  WebContentsView,
} from 'electron';
import { partition } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Subject,
  type Unsubscribable,
} from 'rxjs';

import { isMacOS } from '../../shared/utils';
import { isDev } from '../config';
import { mainWindowOrigin, shellViewUrl } from '../constants';
import { ensureHelperProcess } from '../helper-process';
import { logger } from '../logger';
import { globalStateStorage } from '../shared-storage/storage';
import { parseCookie } from '../utils';
import { getMainWindow, MainWindowManager } from './main-window';
import {
  TabViewsMetaKey,
  type TabViewsMetaSchema,
  tabViewsMetaSchema,
  type WorkbenchMeta,
} from './tab-views-meta-schema';

async function getAdditionalArguments() {
  const { getExposedMeta } = await import('../exposed');
  const mainExposedMeta = getExposedMeta();
  const helperProcessManager = await ensureHelperProcess();
  const helperExposedMeta = await helperProcessManager.rpc?.getMeta();
  return [
    `--main-exposed-meta=` + JSON.stringify(mainExposedMeta),
    `--helper-exposed-meta=` + JSON.stringify(helperExposedMeta),
    `--window-name=main`,
  ];
}

const TabViewsMetaState = {
  $: globalStateStorage
    .watch<TabViewsMetaSchema>(TabViewsMetaKey)
    .pipe(map(v => tabViewsMetaSchema.parse(v ?? {}))),

  set value(value: TabViewsMetaSchema) {
    globalStateStorage.set(TabViewsMetaKey, value);
  },

  get value() {
    return tabViewsMetaSchema.parse(
      globalStateStorage.get(TabViewsMetaKey) ?? {}
    );
  },

  // shallow merge
  patch(patch: Partial<TabViewsMetaSchema>) {
    this.value = {
      ...this.value,
      ...patch,
    };
  },
};

type AddTabAction = {
  type: 'add-tab';
  payload: WorkbenchMeta;
};

type CloseTabAction = {
  type: 'close-tab';
  payload?: string;
};

type PinTabAction = {
  type: 'pin-tab';
  payload: { key: string; shouldPin: boolean };
};

type ActivateViewAction = {
  type: 'activate-view';
  payload: { tabId: string; viewIndex: number };
};

type SeparateViewAction = {
  type: 'separate-view';
  payload: { tabId: string; viewIndex: number };
};

type OpenInSplitViewAction = {
  type: 'open-in-split-view';
  payload: { tabId: string };
};

type TabAction =
  | AddTabAction
  | CloseTabAction
  | PinTabAction
  | ActivateViewAction
  | SeparateViewAction
  | OpenInSplitViewAction;

export class WebContentViewsManager {
  static readonly instance = new WebContentViewsManager(
    MainWindowManager.instance
  );

  private constructor(public mainWindowManager: MainWindowManager) {
    this.setup();
  }

  readonly tabViewsMeta$ = TabViewsMetaState.$;
  readonly tabsBoundingRect$ = new BehaviorSubject<Rectangle | null>(null);

  // all web views
  readonly webViewsMap$ = new BehaviorSubject(
    new Map<string, WebContentsView>()
  );

  // all app views (excluding shell view)
  readonly workbenchViewsMap$ = this.webViewsMap$.pipe(
    map(
      views => new Map([...views.entries()].filter(([key]) => key !== 'shell'))
    )
  );

  /**
   * Emits whenever a tab action is triggered.
   */
  readonly tabAction$ = new Subject<TabAction>();

  readonly activeWorkbenchKey$ = this.tabViewsMeta$.pipe(
    map(m => m?.activeWorkbenchId)
  );
  readonly activeWorkbench$ = combineLatest([
    this.activeWorkbenchKey$,
    this.workbenchViewsMap$,
  ]).pipe(map(([key, views]) => (key ? views.get(key) : undefined)));

  readonly shellView$ = this.webViewsMap$.pipe(
    map(views => views.get('shell'))
  );

  readonly webViewKeys$ = this.webViewsMap$.pipe(
    map(views => Array.from(views.keys()))
  );

  get tabViewsMeta() {
    return TabViewsMetaState.value;
  }

  private set tabViewsMeta(meta: TabViewsMetaSchema) {
    TabViewsMetaState.value = meta;
  }

  readonly patchTabViewsMeta = (patch: Partial<TabViewsMetaSchema>) => {
    TabViewsMetaState.patch(patch);
  };

  get tabsBoundingRect() {
    return this.tabsBoundingRect$.value;
  }

  set tabsBoundingRect(rect: Rectangle | null) {
    this.tabsBoundingRect$.next(rect);
  }

  get shellView() {
    return this.webViewsMap$.value.get('shell');
  }

  get activeWorkbenchId() {
    return this.tabViewsMeta.activeWorkbenchId;
  }

  get activeWorkbenchView() {
    return this.activeWorkbenchId
      ? this.webViewsMap$.value.get(this.activeWorkbenchId)
      : undefined;
  }

  get activeWorkbenchMeta() {
    return this.tabViewsMeta.workbenches.find(
      w => w.id === this.activeWorkbenchId
    );
  }

  get mainWindow() {
    return this.mainWindowManager.mainWindow;
  }

  get tabViewsMap() {
    return this.webViewsMap$.value;
  }

  get allViews() {
    return Array.from(this.tabViewsMap.values());
  }

  updateWorkbenchMeta = (id: string, patch: Partial<WorkbenchMeta>) => {
    const workbenches = this.tabViewsMeta.workbenches;
    const index = workbenches.findIndex(w => w.id === id);
    if (index === -1) {
      return;
    }
    const newWorkbenches = workbenches.toSpliced(index, 1, {
      ...workbenches[index],
      ...patch,
    });
    this.patchTabViewsMeta({
      workbenches: newWorkbenches,
    });
  };

  isActiveTab = (id: string) => {
    return this.activeWorkbenchId === id;
  };

  closeTab = async (id?: string) => {
    if (!id) {
      id = this.activeWorkbenchId;
    }

    if (!id) {
      return;
    }

    const index = this.tabViewsMeta.workbenches.findIndex(w => w.id === id);
    if (index === -1 || this.tabViewsMeta.workbenches.length === 1) {
      return;
    }
    const workbenches = this.tabViewsMeta.workbenches.toSpliced(index, 1);
    // if the active view is closed, switch to the next view (index unchanged)
    // if the new index is out of bound, switch to the last view
    let activeWorkbenchKey = this.activeWorkbenchId;

    if (id === activeWorkbenchKey) {
      activeWorkbenchKey = workbenches[index]?.id ?? workbenches.at(-1)?.id;
    }

    if (!activeWorkbenchKey) {
      return;
    }

    this.patchTabViewsMeta({
      workbenches,
      activeWorkbenchId: activeWorkbenchKey,
    });

    const view = this.tabViewsMap.get(id);

    if (this.mainWindow && view) {
      this.mainWindow.contentView.removeChildView(view);
    }

    await this.showTab(activeWorkbenchKey);
  };

  addTab = async (workbench?: Omit<WorkbenchMeta, 'id'>) => {
    if (!workbench && this.activeWorkbenchMeta) {
      workbench = this.activeWorkbenchMeta;
    }
    if (!workbench) {
      return;
    }
    const workbenches = this.tabViewsMeta.workbenches;
    const newKey = this.generateViewId('app');
    this.patchTabViewsMeta({
      activeWorkbenchId: newKey,
      workbenches: [
        ...workbenches,
        {
          ...workbench,
          views: [
            {
              ...workbench.views[0],
              id: nanoid(),
            },
          ],
          id: newKey,
        },
      ],
    });
    await this.showTab(newKey);
    this.tabAction$.next({
      type: 'add-tab',
      payload: {
        ...workbench,
        id: newKey,
      },
    });
    return {
      ...workbench,
      key: newKey,
    };
  };

  loadTab = async (
    id: string,
    show: boolean = false
  ): Promise<WebContentsView | undefined> => {
    if (!this.tabViewsMeta.workbenches.some(w => w.id === id)) {
      return;
    }

    let view = this.tabViewsMap.get(id);
    if (!view) {
      view = await this.createAndAddView('app', id, show);
      const workbench = this.tabViewsMeta.workbenches.find(w => w.id === id);
      const viewMeta = workbench?.views[workbench.activeViewIndex];
      if (workbench && viewMeta) {
        const url = new URL(
          workbench.basename + (viewMeta.path?.pathname ?? ''),
          mainWindowOrigin
        );
        url.hash = viewMeta.path?.hash ?? '';
        url.search = viewMeta.path?.search ?? '';
        logger.info(`loading tab ${id} at ${url.href}`);
        await view.webContents.loadURL(url.href);
      }
    }
    return view;
  };

  showTab = async (id: string): Promise<WebContentsView | undefined> => {
    if (this.activeWorkbenchId !== id) {
      this.patchTabViewsMeta({
        activeWorkbenchId: id,
      });
    }
    let view = this.tabViewsMap.get(id);
    if (!view) {
      view = await this.loadTab(id, true);
    } else {
      this.bringToFront(id);
    }
    if (view) {
      this.resizeAppView(view);
    }
    return view;
  };

  pinTab = (key: string, shouldPin: boolean) => {
    // move the pinned tab to the last index of the pinned tabs
    const [pinned, unPinned] = partition(
      this.tabViewsMeta.workbenches,
      w => w.pinned
    );

    const workbench = this.tabViewsMeta.workbenches.find(w => w.id === key);
    if (!workbench) {
      return;
    }

    this.tabAction$.next({
      type: 'pin-tab',
      payload: { key, shouldPin },
    });

    if (workbench.pinned && !shouldPin) {
      this.patchTabViewsMeta({
        workbenches: [
          ...pinned.toSpliced(pinned.indexOf(workbench), 1),
          { ...workbench, pinned: false },
          ...unPinned,
        ],
      });
    } else if (!workbench.pinned && shouldPin) {
      this.patchTabViewsMeta({
        workbenches: [
          ...pinned,
          { ...workbench, pinned: true },
          ...unPinned.toSpliced(unPinned.indexOf(workbench), 1),
        ],
      });
    }
  };

  activateView = (tabId: string, viewIndex: number) => {
    this.tabAction$.next({
      type: 'activate-view',
      payload: { tabId, viewIndex },
    });
    this.updateWorkbenchMeta(tabId, {
      activeViewIndex: viewIndex,
    });
  };

  separateView = (tabId: string, viewIndex: number) => {
    const tabMeta = this.tabViewsMeta.workbenches.find(w => w.id === tabId);
    if (!tabMeta) {
      return;
    }
    this.tabAction$.next({
      type: 'separate-view',
      payload: { tabId, viewIndex },
    });
    const newTabMeta: WorkbenchMeta = {
      ...tabMeta,
      activeViewIndex: 0,
      views: [tabMeta.views[viewIndex]],
    };
    this.updateWorkbenchMeta(tabId, {
      views: tabMeta.views.toSpliced(viewIndex, 1),
    });
    addTab(newTabMeta).catch(logger.error);
  };

  openInSplitView = (tabId: string) => {
    const tabMeta = this.tabViewsMeta.workbenches.find(w => w.id === tabId);
    if (!tabMeta) {
      return;
    }
    this.tabAction$.next({
      type: 'open-in-split-view',
      payload: { tabId },
    });
  };

  // todo(@pengx17): handle flickering when switching between tabs
  bringToFront = (key: string) => {
    const view = this.tabViewsMap.get(key);
    if (!this.mainWindow || !view) {
      return;
    }
    this.tabViewsMap.forEach(v => {
      v.setVisible(v === view);
    });
    // always show shell view
    this.shellView?.setVisible(true);
  };

  setup = () => {
    const windowReadyToShow$ = this.mainWindowManager.mainWindow$.pipe(
      filter(w => !!w)
    );

    const disposables: Unsubscribable[] = [];
    disposables.push(
      windowReadyToShow$.subscribe(w => {
        handleWebContentsResize().catch(logger.error);

        w.on('resize', () => {
          if (this.activeWorkbenchView) {
            this.resizeAppView(this.activeWorkbenchView);
          }
        });

        // add shell view
        this.createAndAddView('shell').catch(logger.error);
        (async () => {
          if (this.tabViewsMeta.workbenches.length === 0) {
            // create a default view (e.g., on first launch)
            await this.addTab({
              basename: '/',
              activeViewIndex: 0,
              views: [
                {
                  id: nanoid(),
                },
              ],
            });
          } else {
            const defaultTabId =
              this.activeWorkbenchId ?? this.tabViewsMeta.workbenches[0].id;
            const pendingTabs = this.tabViewsMeta.workbenches
              .map(w => w.id)
              .filter(k => defaultTabId !== k);
            const loadTab = async (
              loadKey: string,
              show: boolean,
              pendingTabs: string[]
            ) => {
              await (show ? this.showTab(loadKey) : this.loadTab(loadKey));

              const next = pendingTabs.shift();
              if (next) {
                await setTimeout(500);
                await loadTab(next, false, pendingTabs);
              }
            };
            await loadTab(defaultTabId, true, pendingTabs);
          }
        })().catch(logger.error);
      })
    );

    disposables.push(
      this.tabsBoundingRect$.subscribe(rect => {
        if (rect) {
          this.shellView?.setBounds(rect);
          this.shellView?.setVisible(true);
        }
      })
    );

    app.on('before-quit', () => {
      disposables.forEach(d => d.unsubscribe());
    });
  };

  setCookie = async (cookie: CookiesSetDetails) => {
    const views = this.allViews;
    if (!views) {
      return;
    }
    logger.info('setting cookie to main window view(s)', cookie);
    for (const view of views) {
      await view.webContents.session.cookies.set(cookie);
    }
  };

  removeCookie = async (url: string, name: string) => {
    const views = this.allViews;
    if (!views) {
      return;
    }
    logger.info('removing cookie from main window view(s)', { url, name });
    for (const view of views) {
      await view.webContents.session.cookies.remove(url, name);
    }
  };

  getCookie = (url?: string, name?: string) => {
    // all webviews share the same session
    const view = this.allViews?.at(0);
    if (!view) {
      return;
    }
    return view.webContents.session.cookies.get({
      url,
      name,
    });
  };

  getViewById = (id: string) => {
    if (id === 'shell') {
      return this.shellView;
    } else {
      return this.tabViewsMap.get(id);
    }
  };

  resizeAppView = (view: View) => {
    this.shellView?.setBounds({
      x: 0,
      y: 0,
      width: this.mainWindow?.getContentBounds().width ?? 0,
      height: 52,
    });
    // app view will take full w/h of the main window
    view.setBounds({
      x: 0,
      y: 52,
      width: this.mainWindow?.getContentBounds().width ?? 0,
      height: (this.mainWindow?.getContentBounds().height ?? 0) - 52,
    });
  };

  private readonly generateViewId = (type: 'app' | 'shell') => {
    return type === 'shell' ? 'shell' : `app-${nanoid()}`;
  };

  private readonly createAndAddView = async (
    type: 'app' | 'shell',
    viewId = this.generateViewId(type),
    show = false
  ) => {
    if (this.shellView && type === 'shell') {
      logger.error('shell view is already created');
    }

    const start = performance.now();

    const additionalArguments = await getAdditionalArguments();
    const helperProcessManager = await ensureHelperProcess();
    // will be added to appInfo
    additionalArguments.push(`--view-id=${viewId}`);

    const view = new WebContentsView({
      webPreferences: {
        webgl: true,
        contextIsolation: true,
        sandbox: false,
        spellcheck: false, // TODO(@pengx17): enable?
        preload: join(__dirname, './preload.js'), // this points to the bundled preload module
        // serialize exposed meta that to be used in preload
        additionalArguments: additionalArguments,
      },
    });

    this.webViewsMap$.next(this.tabViewsMap.set(viewId, view));

    // shell process do not need to connect to helper process
    if (type !== 'shell') {
      let unsub = () => {};
      view.webContents.on('did-finish-load', () => {
        unsub = helperProcessManager.connectRenderer(view.webContents);
      });
      view.webContents.on('destroyed', () => {
        unsub();
        this.webViewsMap$.next(
          new Map(
            [...this.tabViewsMap.entries()].filter(([key]) => key !== viewId)
          )
        );
      });
      this.resizeAppView(view);
    } else {
      view.webContents.on('focus', () => {
        globalThis.setTimeout(() => {
          // when shell is focused, focus the active app view instead (to make sure global keybindings work)
          this.activeWorkbenchView?.webContents.focus();
        });
      });

      await view.webContents.loadURL(shellViewUrl);
      if (isDev) {
        view.webContents.openDevTools();
      }
    }

    const maxIndex = this.mainWindow?.contentView.children.length ?? 0;

    // add to main window when loaded
    // shell view will be added to the top (maxIndex)
    // app view will be added to the second top (maxIndex - 1)
    this.mainWindow?.contentView.addChildView(
      view,
      type === 'shell' ? maxIndex : show ? maxIndex - 1 : 0
    );

    logger.info(`view ${viewId} created in ${performance.now() - start}ms`);
    return view;
  };
}

export async function setCookie(cookie: CookiesSetDetails): Promise<void>;
export async function setCookie(origin: string, cookie: string): Promise<void>;

export async function setCookie(
  arg0: CookiesSetDetails | string,
  arg1?: string
) {
  const details =
    typeof arg1 === 'string' && typeof arg0 === 'string'
      ? parseCookie(arg0, arg1)
      : arg0;

  logger.info('setting cookie to main window', details);

  if (typeof details !== 'object') {
    throw new Error('invalid cookie details');
  }
  return WebContentViewsManager.instance.setCookie(details);
}

export async function removeCookie(url: string, name: string): Promise<void> {
  return WebContentViewsManager.instance.removeCookie(url, name);
}

export async function getCookie(url?: string, name?: string) {
  return WebContentViewsManager.instance.getCookie(url, name);
}

// there is no proper way to listen to webContents resize event
// we will rely on window.resize event in renderer instead
export async function handleWebContentsResize() {
  // right now when window is resized, we will relocate the traffic light positions
  if (isMacOS()) {
    const window = await getMainWindow();
    const factor = window?.webContents.getZoomFactor() || 1;
    window?.setWindowButtonPosition({ x: 20 * factor, y: 24 * factor - 6 });
  }
}

export function onTabViewsMetaChanged(
  fn: (appViewMeta: TabViewsMetaSchema) => void
) {
  const sub = WebContentViewsManager.instance.tabViewsMeta$.subscribe(meta => {
    fn(meta);
  });
  return () => {
    sub.unsubscribe();
  };
}

export const updateWorkbenchMeta = (
  id: string,
  meta: Partial<Omit<WorkbenchMeta, 'id'>>
) => {
  WebContentViewsManager.instance.updateWorkbenchMeta(id, meta);
};
export const getWorkbenchMeta = (id: string) => {
  return TabViewsMetaState.value.workbenches.find(w => w.id === id);
};
export const getTabViewsMeta = () => TabViewsMetaState.value;
export const isActiveTab = WebContentViewsManager.instance.isActiveTab;
export const addTab = WebContentViewsManager.instance.addTab;
export const showTab = WebContentViewsManager.instance.showTab;
export const closeTab = WebContentViewsManager.instance.closeTab;
export const activateView = WebContentViewsManager.instance.activateView;

export const onTabAction = (fn: (event: TabAction) => void) => {
  const { unsubscribe } =
    WebContentViewsManager.instance.tabAction$.subscribe(fn);

  return unsubscribe;
};

export const showDevTools = (id?: string) => {
  const view = id
    ? WebContentViewsManager.instance.getViewById(id)
    : WebContentViewsManager.instance.activeWorkbenchView;
  if (view) {
    view.webContents.openDevTools();
  }
};

export const updateTabsBoundingRect = (rect: Rectangle) => {
  WebContentViewsManager.instance.tabsBoundingRect = rect;
};

export const showTabContextMenu = async (tabId: string, viewIndex: number) => {
  const workbenches = WebContentViewsManager.instance.tabViewsMeta.workbenches;
  const unpinned = workbenches.filter(w => !w.pinned);
  const tabMeta = workbenches.find(w => w.id === tabId);
  if (!tabMeta) {
    return;
  }

  const template: Parameters<typeof Menu.buildFromTemplate>[0] = [
    tabMeta.pinned
      ? {
          label: 'Unpin tab',
          click: () => {
            WebContentViewsManager.instance.pinTab(tabId, false);
          },
        }
      : {
          label: 'Pin tab',
          click: () => {
            WebContentViewsManager.instance.pinTab(tabId, true);
          },
        },
    {
      label: 'Refresh tab',
      click: () => {
        WebContentViewsManager.instance
          .getViewById(tabId)
          ?.webContents.reload();
      },
    },
    {
      label: 'Duplicate tab',
      click: () => {
        addTab(tabMeta).catch(logger.error);
      },
    },

    { type: 'separator' },

    tabMeta.views.length > 1
      ? {
          label: 'Separate tabs',
          click: () => {
            WebContentViewsManager.instance.separateView(tabId, viewIndex);
          },
        }
      : {
          label: 'Open in split view',
          click: () => {
            WebContentViewsManager.instance.openInSplitView(tabId);
          },
        },

    ...(unpinned.length > 1
      ? ([
          { type: 'separator' },
          {
            label: 'Close tab',
            click: () => {
              closeTab(tabId).catch(logger.error);
            },
          },
          {
            label: 'Close other tabs',
            click: () => {
              const tabsToRetain =
                WebContentViewsManager.instance.tabViewsMeta.workbenches.filter(
                  w => w.id === tabId || w.pinned
                );

              WebContentViewsManager.instance.patchTabViewsMeta({
                workbenches: tabsToRetain,
              });
            },
          },
        ] as const)
      : []),
  ];
  const menu = Menu.buildFromTemplate(template);
  menu.popup();
};
