import { useCallback, useSyncExternalStore } from 'react'
import {
  getPersistentScBootstrapSnapshot,
  subscribePersistentScBootstrap,
  type PersistentScBootstrap,
} from './persistentScBootstrap'

export function usePersistentScBootstrap(): PersistentScBootstrap {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribePersistentScBootstrap(onStoreChange),
    [],
  )
  const getSnapshot = useCallback(() => getPersistentScBootstrapSnapshot(), [])
  const getServerSnapshot = useCallback((): PersistentScBootstrap => {
    return { url: null, autoPlay: false, generation: 0 }
  }, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
