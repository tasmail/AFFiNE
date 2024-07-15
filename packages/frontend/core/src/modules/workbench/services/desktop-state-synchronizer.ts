import {
  apis,
  appInfo,
  events,
  type WorkbenchViewMeta,
} from '@affine/electron-api';
import { I18n, type I18nKeys, i18nTime } from '@affine/i18n';
import { Service } from '@toeverything/infra';
import { combineLatest, switchMap } from 'rxjs';

import { resolveRouteLinkMeta } from '../../navigation';
import type { RouteModulePath } from '../../navigation/utils';
import type { WorkspacePropertiesAdapter } from '../../properties';
import type { WorkbenchService } from './workbench';

const routeModuleToI18n = {
  all: 'All pages',
  collection: 'Collections',
  tag: 'Tags',
  trash: 'Trash',
} satisfies Record<RouteModulePath, I18nKeys>;

/**
 * Synchronize workbench state with state stored in main process
 * todo: how to make sure it is eagerly loaded?
 */
export class DesktopStateSynchronizer extends Service {
  constructor(
    private readonly workbenchService: WorkbenchService,
    private readonly workspaceProperties: WorkspacePropertiesAdapter
  ) {
    super();

    if (!environment.isDesktop) {
      return;
    }

    const workbench = this.workbenchService.workbench;

    events?.ui.onTabAction(event => {
      if (
        event.type === 'open-in-split-view' &&
        event.payload.tabId === appInfo?.tabViewId
      ) {
        const activeView = workbench.activeView$.value;
        if (activeView) {
          workbench.open(activeView.location$.value, {
            at: 'beside',
          });
        }
      }

      if (
        event.type === 'separate-view' &&
        event.payload.tabId === appInfo?.tabViewId
      ) {
        const view = workbench.viewAt(event.payload.viewIndex);
        if (view) {
          workbench.close(view);
        }
      }

      if (
        event.type === 'activate-view' &&
        event.payload.tabId === appInfo?.tabViewId
      ) {
        workbench.active(event.payload.viewIndex);
      }
    });

    events?.ui.onToggleRightSidebar(tabId => {
      if (tabId === appInfo?.tabViewId) {
        workbench.sidebarOpen$.next(!workbench.sidebarOpen$.value);
      }
    });

    workbench.views$
      .pipe(
        switchMap(views => {
          return combineLatest(
            views.map(view =>
              view.location$.map(location => {
                return {
                  view,
                  location,
                };
              })
            )
          );
        })
      )
      .subscribe(viewLocations => {
        if (!apis || !appInfo?.tabViewId) {
          return;
        }

        const viewMetas = viewLocations.map(({ view, location }) => {
          return {
            id: view.id,
            path: location,
          };
        });
        apis.ui
          .updateWorkbenchMeta(appInfo.tabViewId, {
            views: viewMetas.map(viewMeta => this.fillTabViewMeta(viewMeta)),
          })
          .catch(console.error);
      });

    workbench.activeViewIndex$.subscribe(activeViewIndex => {
      if (!apis || !appInfo?.tabViewId) {
        return;
      }

      apis.ui
        .updateWorkbenchMeta(appInfo.tabViewId, {
          activeViewIndex: activeViewIndex,
        })
        .catch(console.error);
    });

    workbench.basename$.subscribe(basename => {
      if (!apis || !appInfo?.tabViewId) {
        return;
      }

      apis.ui
        .updateWorkbenchMeta(appInfo.tabViewId, {
          basename: basename,
        })
        .catch(console.error);
    });
  }

  private toFullUrl(
    basename: string,
    location: { hash?: string; pathname: string; search?: string }
  ) {
    return basename + location.pathname + location.search + location.hash;
  }

  // fill tab view meta with title & moduleName
  private fillTabViewMeta(view: WorkbenchViewMeta): WorkbenchViewMeta {
    if (!view.path) {
      return view;
    }

    const url = this.toFullUrl(
      this.workbenchService.workbench.basename$.value,
      view.path
    );
    const linkMeta = resolveRouteLinkMeta(url);

    if (!linkMeta) {
      return view;
    }

    const journalString =
      linkMeta.moduleName === 'doc'
        ? this.workspaceProperties.getJournalPageDateString(linkMeta.docId)
        : undefined;
    const isJournal = !!journalString;

    const title = (() => {
      if (linkMeta?.moduleName === 'doc') {
        if (journalString) {
          return i18nTime(journalString, { absolute: { accuracy: 'day' } });
        }
        return (
          this.workspaceProperties.workspace.docCollection.meta.getDocMeta(
            linkMeta.docId
          )?.title || I18n['Untitled']()
        );
      } else {
        return I18n[routeModuleToI18n[linkMeta.moduleName]]();
      }
    })();

    return {
      ...view,
      title: title,
      moduleName: isJournal ? 'journal' : linkMeta.moduleName,
    };
  }
}
