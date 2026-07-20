import React, { createContext, useCallback, useContext, useState } from 'react';
import { ActionSheet, ActionSheetOption } from '../components/ActionSheet';

type ShowActionSheetArgs = {
  message?: string;
  options: ActionSheetOption[];
};

type ActionSheetContextType = {
  showActionSheet: (args: ShowActionSheetArgs) => void;
};

const ActionSheetContext = createContext<ActionSheetContextType | null>(null);

export function useActionSheet(): ActionSheetContextType {
  const ctx = useContext(ActionSheetContext);
  if (!ctx) throw new Error('useActionSheet must be used within ActionSheetProvider');
  return ctx;
}

export function ActionSheetProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<ShowActionSheetArgs | null>(null);

  const showActionSheet = useCallback((args: ShowActionSheetArgs) => {
    setSheet(args);
  }, []);

  const close = useCallback(() => setSheet(null), []);

  // Each option dismisses the sheet before running its own onPress, matching
  // how the native system action sheet used to behave (dismiss, then the
  // tapped action runs) without callers having to remember to close it.
  const wrappedOptions: ActionSheetOption[] = (sheet?.options ?? []).map(opt => ({
    ...opt,
    onPress: () => {
      close();
      opt.onPress();
    },
  }));
  const cancelOption = wrappedOptions.find(o => o.style === 'cancel');

  return (
    <ActionSheetContext.Provider value={{ showActionSheet }}>
      {children}
      <ActionSheet
        visible={sheet !== null}
        message={sheet?.message}
        options={wrappedOptions}
        onRequestClose={() => (cancelOption ? cancelOption.onPress() : close())}
      />
    </ActionSheetContext.Provider>
  );
}
