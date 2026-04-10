/**
 * Pedagogical Dimensions Config Context
 *
 * Provides access to the runtime pedagogical dimensions configuration
 * loaded during app bootstrap. Allows dimension derivation to work
 * throughout the app without prop drilling.
 */

import { createContext, ReactNode, useContext } from "react";
import type { PedagogicalDimensionsConfig } from "../config/pedagogical-dimensions-config";

// ============================================================================
// CONTEXT DEFINITION
// ============================================================================

interface PedagogicalConfigContextType {
  config: PedagogicalDimensionsConfig | null;
  isLoading: boolean;
  error: Error | null;
}

const PedagogicalConfigContext = createContext<PedagogicalConfigContextType | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export interface PedagogicalConfigProviderProps {
  value: PedagogicalConfigContextType;
  children: ReactNode;
}

export function PedagogicalConfigProvider({
  value,
  children,
}: PedagogicalConfigProviderProps) {
  return (
    <PedagogicalConfigContext.Provider value={value}>
      {children}
    </PedagogicalConfigContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Access the pedagogical dimensions configuration
 *
 * Returns null if the config is not yet loaded (during bootstrap).
 * Provides error state for debugging if config loading failed.
 *
 * @returns PedagogicalConfigContextType with config, loading, error states
 */
export function usePedagogicalConfig(): PedagogicalConfigContextType {
  const context = useContext(PedagogicalConfigContext);
  if (!context) {
    // Return safe defaults if context not initialized
    // This allows code to reference usePedagogicalConfig() before bootstrap completes
    return {
      config: null,
      isLoading: true,
      error: null,
    };
  }
  return context;
}

// ============================================================================
// SAFE EXPORTS FOR TYPE CHECKING
// ============================================================================

/**
 * Check if pedagogical config is ready for use
 */
export function isPedagogicalConfigReady(ctx: PedagogicalConfigContextType): boolean {
  return !ctx.isLoading && ctx.config !== null && ctx.error === null;
}
