import {useRef, useState} from 'react';
import type {AiCatalogKind} from '../../ports/aiCatalog';
import {AiModelPicker} from './AiModelPicker';
import {catalogLabels} from './aiModelCatalog';
import {choosePreviewModel, effortLabels, modelPresetCapabilities, modelPresetFor, previewModel, type AiConnectionPreview, type AiModelPreview, type AiServicePreview} from './aiSettingsModel';
import {SettingsChoice, SettingsSheet} from './SettingsLayout';

/** Keep the catalog mounted while the next choice slides over it. */
export function AiModelSelectionSheet({service, connection, kind, onSelect, onRefresh, onManualChange, onClose}: {
  service: AiServicePreview;
  connection: AiConnectionPreview;
  kind: AiCatalogKind;
  onSelect: (model: AiModelPreview, effort?: string) => void;
  onRefresh: (models: AiModelPreview[]) => void;
  onManualChange: (model: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<AiModelPreview | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const completed = useRef(new Set<'models' | 'effort'>());
  const stepModel = step && connection.model === step.id ? previewModel(service, step.id, connection) : step;
  const stepConnection = stepModel ? choosePreviewModel(service.id, connection, stepModel) : connection;
  const efforts = modelPresetCapabilities(service, stepConnection).efforts;
  const selectedEffort = modelPresetFor(service.id, stepConnection).effort;

  const finishPanel = (panel: 'models' | 'effort') => {
    if (!finishingRef.current) {
      if (panel === 'effort') setStep(null); else onClose();
      return;
    }
    completed.current.add(panel);
    // Do not unmount the horizontal spring when the lower sheet finishes first.
    if (completed.current.size === 2) onClose();
  };

  return <SettingsSheet title={catalogLabels[kind]} onClose={() => finishPanel('models')} dismiss={finishing} obscured={step !== null} overlay={stepModel && <SettingsSheet title="추론 레벨" slideFrom="right" dismiss={finishing} onClose={() => finishPanel('effort')}>
    {() => <>{efforts.map(effort => <SettingsChoice key={effort} label={effortLabels[effort] ?? effort} selected={selectedEffort === effort} onPress={() => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      onSelect(stepModel, effort);
      setFinishing(true);
    }}/>)}</>}
  </SettingsSheet>}>
    {close => <AiModelPicker service={service} connection={connection} kind={kind} onRefresh={onRefresh} onManualChange={onManualChange} onSelect={next => {
      if (step || finishingRef.current) return;
      onSelect(next);
      if (kind === 'chat' && modelPresetCapabilities(service, choosePreviewModel(service.id, connection, next)).efforts.length) setStep(next);
      else close();
    }}/>}
  </SettingsSheet>;
}
