import { useGlobalStateValue } from '@toeverything/infra';

import { NavigationButtons } from '../../../modules/navigation';
import { LEFT_SIDEBAR_OPEN_KEY } from '..';
import { navHeaderStyle } from '../index.css';
import { SidebarSwitch } from './sidebar-switch';

export const SidebarHeader = () => {
  const open = useGlobalStateValue(LEFT_SIDEBAR_OPEN_KEY, true);

  return (
    <div
      className={navHeaderStyle}
      data-open={open}
      data-is-macos-electron={environment.isDesktop && environment.isMacOs}
    >
      <SidebarSwitch show={open} />
      <NavigationButtons />
    </div>
  );
};

export * from './sidebar-switch';
