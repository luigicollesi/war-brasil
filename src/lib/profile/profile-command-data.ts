import type {
  CommanderSearchResult,
  ProfileCommandSnapshot,
} from "./profile-command-contract";
import {
  LOCAL_PROFILE_COMMAND_SNAPSHOT,
  searchLocalCommanders,
} from "./profile-local-fixture";

/**
 * Stable boundary for the Quartel do Comandante redesign.
 *
 * Today it intentionally returns local-static data so the full interface can be
 * built before authentication, wallet, social, history and storefront services
 * exist. Future adapters should replace this implementation without exposing
 * provider-specific payloads to React components.
 */
export async function getCurrentProfileCommandSnapshot(): Promise<ProfileCommandSnapshot> {
  return LOCAL_PROFILE_COMMAND_SNAPSHOT;
}

/**
 * Search is intentionally separate from the main snapshot so the profile never
 * needs to load a global player directory just to render the Rede de Comando.
 */
export async function searchProfileCommanders(
  query: string,
): Promise<ReadonlyArray<CommanderSearchResult>> {
  return searchLocalCommanders(query);
}
