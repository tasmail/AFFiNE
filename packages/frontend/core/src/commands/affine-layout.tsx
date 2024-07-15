import type { useI18n } from '@affine/i18n';
import { SidebarIcon } from '@blocksuite/icons/rc';
import type { GlobalState } from '@toeverything/infra';

import { LEFT_SIDEBAR_OPEN_KEY } from '../components/app-sidebar';
import { registerAffineCommand } from './registry';

export function registerAffineLayoutCommands({
  t,
  globalState,
}: {
  t: ReturnType<typeof useI18n>;
  globalState: GlobalState;
}) {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    registerAffineCommand({
      id: 'affine:toggle-left-sidebar',
      category: 'affine:layout',
      icon: <SidebarIcon />,
      label: () =>
        globalState.get(LEFT_SIDEBAR_OPEN_KEY)
          ? t['com.affine.cmdk.affine.left-sidebar.collapse']()
          : t['com.affine.cmdk.affine.left-sidebar.expand'](),

      keyBinding: {
        binding: '$mod+/',
      },
      run() {
        globalState.set(
          LEFT_SIDEBAR_OPEN_KEY,
          !globalState.get(LEFT_SIDEBAR_OPEN_KEY)
        );
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
