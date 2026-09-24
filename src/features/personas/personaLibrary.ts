import type {Persona, PersonaFolder} from './personaPreferences';

export type PersonaEntry = {kind: 'persona'; item: Persona} | {kind: 'folder'; item: PersonaFolder};
export const personaEntryKey = (entry: PersonaEntry) => `${entry.kind}:${entry.item.id}`;
