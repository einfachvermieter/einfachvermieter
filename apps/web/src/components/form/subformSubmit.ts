import { createContext, type ReactNode } from "react";

/**
 * Beschriftung und Icon des Bestätigen-Buttons, die eine umgebende Liste
 * (EditableListSection) je nach Anlegen/Bearbeiten vorgibt. Ohne Provider
 * greift die `submitLabel`-Prop des SubformShell bzw. der Standard.
 */
export type SubformSubmit = { label: string; icon?: ReactNode };

export const SubformSubmitContext = createContext<SubformSubmit | null>(null);
export const SubformSubmitProvider = SubformSubmitContext.Provider;
