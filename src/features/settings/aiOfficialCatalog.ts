import data from './catalogs/officialModels.json';
import type {AiCatalogKind} from '../../ports/aiCatalog';
import type {AiModelPreview, AiService} from './aiSettingsModel';

export interface OfficialModel extends AiModelPreview {
  kind: AiCatalogKind;
  retiresOn?: string;
}
export interface OfficialProviderCatalog {
  sources: string[];
  models: OfficialModel[];
}

/** Public documentation, not a promise of access for a particular account or region. */
export const officialCatalog = data as {
  checkedAt: string;
  providers: Record<AiService, OfficialProviderCatalog>;
};
export const officialCatalogDate = officialCatalog.checkedAt;

export function officialModels(service: AiService, kind: AiCatalogKind, date = new Date().toISOString().slice(0, 10)): AiModelPreview[] {
  return officialCatalog.providers[service].models
    .filter(model => model.kind === kind && (!model.retiresOn || model.retiresOn > date))
    .map(({kind: _kind, retiresOn: _retirement, ...model}) => ({...model, effort: [...model.effort], tools: [...model.tools]}));
}

export function officialCatalogKinds(service: AiService): AiCatalogKind[] {
  return (['chat', 'image', 'video', 'audio', 'voice'] as const).filter(kind => kind === 'chat' || officialModels(service, kind).length > 0);
}
