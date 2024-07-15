import { useGlobalState } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { LEFT_SIDEBAR_OPEN_KEY } from '../../components/app-sidebar';

export function useSwitchSidebarStatus() {
  const [isOpened, setOpened] = useGlobalState(LEFT_SIDEBAR_OPEN_KEY, true);

  const onOpenChange = useCallback(() => {
    setOpened(!isOpened);
  }, [isOpened, setOpened]);

  return useMemo(
    () => ({
      onOpenChange,
      isOpened,
    }),
    [isOpened, onOpenChange]
  );
}
