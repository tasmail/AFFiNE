import { Skeleton } from '@affine/component';
import { ResizePanel } from '@affine/component/resize-panel';
import {
  GlobalStateService,
  useGlobalState,
  useGlobalStateValue,
  useService,
  useServiceOptional,
  WorkspaceService,
} from '@toeverything/infra';
import { useAtom } from 'jotai';
import { debounce } from 'lodash-es';
import type { PropsWithChildren, ReactElement } from 'react';
import { useEffect } from 'react';

import { WorkspaceSelector } from '../workspace-selector';
import { fallbackHeaderStyle, fallbackStyle } from './fallback.css';
import {
  floatingMaxWidth,
  navBodyStyle,
  navHeaderStyle,
  navStyle,
  navWrapperStyle,
  sidebarFloatMaskStyle,
} from './index.css';
import {
  APP_SIDEBAR_OPEN,
  appSidebarFloatingAtom,
  appSidebarResizingAtom,
} from './index.jotai';
import { SidebarHeader } from './sidebar-header';

export type AppSidebarProps = PropsWithChildren<{
  clientBorder?: boolean;
  translucentUI?: boolean;
}>;

export type History = {
  stack: string[];
  current: number;
};

const MAX_WIDTH = 480;
const MIN_WIDTH = 256;

export const LEFT_SIDEBAR_WIDTH_KEY =
  'app:settings:leftsidebar:sidebar-state:width';
export const LEFT_SIDEBAR_OPEN_KEY =
  'app:settings:leftsidebar:sidebar-state:open';

export function AppSidebar({
  children,
  clientBorder,
  translucentUI,
}: AppSidebarProps): ReactElement {
  const globalState = useService(GlobalStateService).globalState;
  const [open, setOpen] = useGlobalState(LEFT_SIDEBAR_OPEN_KEY, true);
  const [width, setWidth] = useGlobalState(LEFT_SIDEBAR_WIDTH_KEY, 256);

  const [floating, setFloating] = useAtom(appSidebarFloatingAtom);
  const [resizing, setResizing] = useAtom(appSidebarResizingAtom);

  useEffect(() => {
    function onResize() {
      const isFloatingMaxWidth = window.matchMedia(
        `(max-width: ${floatingMaxWidth}px)`
      ).matches;
      const isOverflowWidth = window.matchMedia(
        `(max-width: ${width / 0.4}px)`
      ).matches;
      const isFloating = isFloatingMaxWidth || isOverflowWidth;
      if (
        open === undefined &&
        localStorage.getItem(APP_SIDEBAR_OPEN) === null
      ) {
        // give the initial value,
        // so that the sidebar can be closed on mobile by default
        globalState.set(LEFT_SIDEBAR_OPEN_KEY, !isFloating);
      }
      setFloating(isFloating);
    }

    const dOnResize = debounce(onResize, 50);
    window.addEventListener('resize', dOnResize);
    return () => {
      window.removeEventListener('resize', dOnResize);
    };
  }, [globalState, open, setFloating, width]);

  const isMacosDesktop = environment.isDesktop && environment.isMacOs;
  const hasRightBorder =
    !environment.isDesktop || (!clientBorder && !translucentUI);

  return (
    <>
      <ResizePanel
        floating={floating}
        open={open}
        resizing={resizing}
        maxWidth={MAX_WIDTH}
        minWidth={MIN_WIDTH}
        width={width}
        resizeHandlePos="right"
        onOpen={setOpen}
        onResizing={setResizing}
        onWidthChange={setWidth}
        className={navWrapperStyle}
        resizeHandleOffset={clientBorder ? 8 : 0}
        resizeHandleVerticalPadding={clientBorder ? 16 : 0}
        data-transparent
        data-has-border={hasRightBorder}
        data-testid="app-sidebar-wrapper"
        data-is-macos-electron={isMacosDesktop}
      >
        <nav className={navStyle} data-testid="app-sidebar">
          <SidebarHeader />
          <div className={navBodyStyle} data-testid="sliderBar-inner">
            {children}
          </div>
        </nav>
      </ResizePanel>
      <div
        data-testid="app-sidebar-float-mask"
        data-open={open}
        data-is-floating={floating}
        className={sidebarFloatMaskStyle}
        onClick={() => setOpen(false)}
      />
    </>
  );
}

export const AppSidebarFallback = (): ReactElement | null => {
  const width = useGlobalStateValue(LEFT_SIDEBAR_WIDTH_KEY, 256);

  const currentWorkspace = useServiceOptional(WorkspaceService);
  return (
    <div
      style={{ width }}
      className={navWrapperStyle}
      data-has-border
      data-open="true"
    >
      <nav className={navStyle}>
        <div className={navHeaderStyle} data-open="true" />
        <div className={navBodyStyle}>
          <div className={fallbackStyle}>
            <div className={fallbackHeaderStyle}>
              {currentWorkspace ? (
                <WorkspaceSelector />
              ) : (
                <>
                  <Skeleton variant="circular" width={40} height={40} />
                  <Skeleton variant="rectangular" width={150} height={40} />
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export * from './add-page-button';
export * from './app-download-button';
export * from './app-updater-button';
export * from './category-divider';
export * from './index.css';
export * from './menu-item';
export * from './quick-search-input';
export * from './sidebar-containers';
export * from './sidebar-header';
export { appSidebarFloatingAtom, appSidebarResizingAtom };
