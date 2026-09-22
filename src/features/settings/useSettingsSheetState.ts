import {useCallback, useState} from 'react';

/** A new opening owns its dismissal, even if a previous sheet is still leaving. */
export function useSettingsSheetState<T>() {
  const [selection, setSelection] = useState<{value: T | null; revision: number}>({value: null, revision: 0});
  const setSheet = useCallback((value: T | null) => {
    setSelection(previous => ({value, revision: previous.revision + 1}));
  }, []);
  const closeSheet = useCallback(() => {
    setSelection(previous => previous.revision === selection.revision ? {...previous, value: null} : previous);
  }, [selection.revision]);
  return {sheet: selection.value, sheetKey: selection.revision, setSheet, closeSheet};
}
