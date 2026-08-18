import { createContext, useContext } from "react";

type EditModeValue = { editable: boolean };

const EditModeContext = createContext<EditModeValue>({ editable: false });

export const EditModeProvider = EditModeContext.Provider;

export function useEditMode() {
  return useContext(EditModeContext).editable;
}
