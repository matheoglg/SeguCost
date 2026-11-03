// M-04 Registrar producción (RF-15). Extrusion asks for kg; printing, sealing and die cutting for units.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { NumberPad, PadField } from '@/components/mobile/NumberPad';
import { showToast } from '@/components/Toast';
import { stageLabels } from '@/domain/labels';
import { formatKg, formatNumber, parseNumber } from '@/format';
import { recordProduction } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { runningEntry, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { spacing } from '@/theme';

type FieldKey = 'raw' | 'roll' | 'units';

export default function RecordProductionScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const entry = runningEntry(db, user.id);
  const info = entry && stageInfo(db, entry.stageId);
  const isExtrusion = info?.stage.type === 'extrusion';
  const [values, setValues] = useState<Record<FieldKey, string>>({ raw: '', roll: '', units: '' });
  const [active, setActive] = useState<FieldKey>(isExtrusion ? 'raw' : 'units');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!entry || !info) {
    return (
      <MobileScreen>
        <MText>Inicie una operación para registrar producción.</MText>
      </MobileScreen>
    );
  }

  const save = () => {
    const data = isExtrusion
      ? { rawMaterialKg: parseNumber(values.raw), rollKg: parseNumber(values.roll) }
      : { units: parseNumber(values.units) };
    const result = recordProduction(info.stage.id, user.id, data);
    if (!result.ok) {
      setErrors(result.errors);
      return showToast('error', 'Revise los datos ingresados');
    }
    showToast(
      'success',
      isExtrusion ? `Producción guardada: ${formatKg(data.rollKg!)} de rollo` : `Producción guardada: ${formatNumber(data.units!)} unidades`,
    );
    router.back();
  };

  return (
    <MobileScreen footer={<Button title="Guardar" size="lg" onPress={save} testID="save-production" />}>
      <MTitle>
        {stageLabels[info.stage.type]} · {info.order.code}
      </MTitle>
      {isExtrusion ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <PadField testID="field-raw" label="Materia prima usada" unit="kg" value={values.raw} active={active === 'raw'} onPress={() => setActive('raw')} error={errors.rawMaterialKg} />
          <PadField testID="field-roll" label="Rollo producido" unit="kg" value={values.roll} active={active === 'roll'} onPress={() => setActive('roll')} error={errors.rollKg} />
        </View>
      ) : (
        <PadField testID="field-units" label="Unidades producidas" unit="u" value={values.units} active onPress={() => setActive('units')} error={errors.units} />
      )}
      <NumberPad
        value={values[active]}
        decimals={active !== 'units'}
        onChange={(v) => {
          setValues((s) => ({ ...s, [active]: v }));
          setErrors({});
        }}
      />
    </MobileScreen>
  );
}
