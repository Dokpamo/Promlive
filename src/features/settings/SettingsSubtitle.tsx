import type {ReactNode} from 'react';
import {Text, useWindowDimensions} from 'react-native';
import {useAppearance} from '../appearance/AppAppearance';
import {headerScale, referenceTypography} from '../../layout/metrics';
import {panelReference as r} from '../../layout/panelGeometry';

/** Section headings and field labels share the text inset of a settings row. */
export function SettingsSubtitle({children, section = false}: {children: ReactNode; section?: boolean}) {
  const {settings: p} = useAppearance();
  const s = headerScale(useWindowDimensions().width);
  return <Text accessibilityRole={section ? 'header' : undefined} style={{
    color: p.secondary, fontSize: r.subtitle.fontSize * s, lineHeight: r.subtitle.lineHeight * s,
    fontWeight: referenceTypography.titleWeight, includeFontPadding: false,
    marginHorizontal: r.rowInset * s, marginTop: section ? r.subtitle.sectionTop * s : 0,
    marginBottom: r.subtitle.bottom * s,
  }}>{children}</Text>;
}
