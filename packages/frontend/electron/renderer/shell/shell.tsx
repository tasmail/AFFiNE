import { IconButton } from '@affine/component';
import { LEFT_SIDEBAR_OPEN_KEY } from '@affine/core/components/app-sidebar';
import type { TabViewsMetaSchema, WorkbenchMeta } from '@affine/electron-api';
import { apis, TabViewsMetaKey } from '@affine/electron-api';
import {
  CloseIcon,
  DeleteIcon,
  FolderIcon,
  PageIcon,
  PlusIcon,
  RightSidebarIcon,
  SidebarIcon,
  TagIcon,
  TodayIcon,
  ViewLayersIcon,
} from '@blocksuite/icons/rc';
import { useGlobalState, useGlobalStateValue } from '@toeverything/infra';
import { partition } from 'lodash-es';
import { Fragment, type ReactNode, useCallback } from 'react';

import * as styles from './shell.css';
import { WindowsAppControls } from './windows-app-controls';

type ModuleName = NonNullable<WorkbenchMeta['views'][0]['moduleName']>;

const moduleNameToIcon = {
  all: <FolderIcon />,
  collection: <ViewLayersIcon />,
  doc: <PageIcon />,
  journal: <TodayIcon />,
  tag: <TagIcon />,
  trash: <DeleteIcon />,
} satisfies Record<ModuleName, ReactNode>;

const WorkbenchTab = ({
  workbench,
  active: tabActive,
  tabsLength,
}: {
  workbench: TabViewsMetaSchema['workbenches'][0];
  active: boolean;
  tabsLength: number;
}) => {
  const activeViewIndex = workbench.activeViewIndex ?? 0;
  return (
    <div
      role="button"
      key={workbench.id}
      data-active={tabActive}
      className={styles.tab}
    >
      {workbench.views.map((view, viewIdx) => {
        return (
          <Fragment key={view.id}>
            <button
              key={view.id}
              className={styles.splitViewLabel}
              data-active={activeViewIndex === viewIdx && tabActive}
              onContextMenu={() => {
                apis?.ui.showTabContextMenu(workbench.id, viewIdx);
              }}
              onClick={e => {
                e.stopPropagation();
                apis?.ui.showTab(workbench.id).then(() => {
                  apis?.ui.activateView(workbench.id, viewIdx);
                });
              }}
            >
              <div className={styles.labelIcon}>
                {moduleNameToIcon[view.moduleName ?? 'doc']}
              </div>
              {workbench.pinned ? null : (
                <div className={styles.splitViewLabelText}>{view.title}</div>
              )}
            </button>

            {viewIdx !== workbench.views.length - 1 && (
              <div className={styles.splitViewSeparator} />
            )}
          </Fragment>
        );
      })}
      {!workbench.pinned && tabsLength > 1 ? (
        <IconButton
          size="small"
          type="plain"
          className={styles.controlIconButton}
          onClick={e => {
            e.stopPropagation();
            apis?.ui.closeTab(workbench.id);
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </div>
  );
};

export function ShellRoot() {
  const tabViewsMeta = useGlobalStateValue<TabViewsMetaSchema>(
    TabViewsMetaKey,
    {
      workbenches: [],
      activeWorkbenchId: '',
    }
  );
  const [leftSidebarOpen, setLeftSidebarOpen] = useGlobalState(
    LEFT_SIDEBAR_OPEN_KEY,
    true
  );
  const activeWorkbench = tabViewsMeta.workbenches.find(
    workbench => workbench.id === tabViewsMeta.activeWorkbenchId
  );
  const activeView =
    activeWorkbench?.views[activeWorkbench.activeViewIndex ?? 0];

  const [pinned, unpinned] = partition(
    tabViewsMeta.workbenches,
    workbench => workbench.pinned
  );

  const onAddTab = useCallback(() => {
    if (activeView && activeWorkbench) {
      apis?.ui.addTab({
        activeViewIndex: 0,
        basename: activeWorkbench.basename,
        views: [activeView],
      });
    }
  }, [activeView, activeWorkbench]);

  return (
    <div className={styles.root}>
      <IconButton
        size="large"
        onClick={() => {
          setLeftSidebarOpen(!leftSidebarOpen);
        }}
      >
        <SidebarIcon />
      </IconButton>
      <div className={styles.tabs}>
        {pinned.map(workbench => {
          const tabActive = workbench.id === tabViewsMeta.activeWorkbenchId;
          return (
            <WorkbenchTab
              tabsLength={pinned.length}
              key={workbench.id}
              workbench={workbench}
              active={tabActive}
            />
          );
        })}
        {pinned.length > 0 && unpinned.length > 0 && (
          <div className={styles.pinSeparator} />
        )}
        {unpinned.map(workbench => {
          const tabActive = workbench.id === tabViewsMeta.activeWorkbenchId;
          return (
            <WorkbenchTab
              tabsLength={unpinned.length}
              key={workbench.id}
              workbench={workbench}
              active={tabActive}
            />
          );
        })}
        <div className={styles.divider} />
        <IconButton onClick={onAddTab}>
          <PlusIcon />
        </IconButton>
      </div>
      <IconButton
        size="large"
        onClick={() => {
          apis?.ui.toggleRightSidebar();
        }}
      >
        <RightSidebarIcon />
      </IconButton>
      <WindowsAppControls />
    </div>
  );
}
