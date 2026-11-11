"use client";
import { createContext, useContext } from "react";

type SheetContextValue = {
  /** Switch to the Sources tab filtered to these observation ids. */
  showSources: (ids: number[]) => void;
};

export const SheetContext = createContext<SheetContextValue | null>(null);
export const useSheet = () => useContext(SheetContext);
