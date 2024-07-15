import { useCallback } from 'react';

import { useService } from '../../framework';
import { LiveData, useLiveData } from '../../livedata';
import { GlobalCacheService, GlobalStateService } from './services/global';

export function useGlobalState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void];

export function useGlobalState<T>(
  key: string
): [T | undefined, (value: T) => void];

export function useGlobalState<T>(key: string, defaultValue?: T) {
  const globalState = useService(GlobalStateService).globalState;
  const value$ = globalState.watch(key);
  const v = useLiveData(LiveData.from(value$, defaultValue));
  const set = useCallback(
    (value: T) => globalState.set(key, value),
    [globalState, key]
  );
  return [v, set] as const;
}

export function useGlobalStateValue<T>(key: string, defaultValue: T): T;
export function useGlobalStateValue<T>(key: string): T | undefined;

export function useGlobalStateValue<T>(key: string, defaultValue?: T) {
  return useGlobalState(key, defaultValue)[0];
}

export function useGlobalCache<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void];

export function useGlobalCache<T>(
  key: string
): [T | undefined, (value: T) => void];

export function useGlobalCache<T>(key: string, defaultValue?: T) {
  const globalCache = useService(GlobalCacheService).globalCache;
  const value$ = globalCache.watch(key);
  const v = useLiveData(LiveData.from(value$, defaultValue));
  const set = useCallback(
    (value: T) => globalCache.set(key, value),
    [globalCache, key]
  );
  return [v, set] as const;
}

export function useGlobalCacheValue<T>(key: string, defaultValue: T): T;
export function useGlobalCacheValue<T>(key: string): T | undefined;

export function useGlobalCacheValue<T>(key: string, defaultValue?: T) {
  return useGlobalCache(key, defaultValue)[0];
}
