// M-05 Registrar merma (RF-16, RF-17). kg plus destination; over the threshold the supervisor is alerted.
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Segmented } from '@/components/Inputs';
import { MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { NumberPad, PadField } from '@/components/mobile/NumberPad';
import { showToast } from '@/components/Toast';
import { stageLabels, wasteDestinationLabels } from '@/domain/labels';
import type { WasteDestination } from '@/domain/types';
import { formatKg, formatPercent, parseNumber } from '@/format';
import { recordWaste } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { runningEntry, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';

const DESTINATIONS = (Object.keys(wasteDestinationLabels) as WasteDestination[]).map((value) => ({ value, label: wasteDestinationLabels[value] }));

export default function RecordWasteScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const entry = runningEntry(db, user.id);
  const info = entry && stageInfo(db, entry.stageId);
  const [kg, setKg] = useState('');
  const [destination, setDestination] = useState<WasteDestination>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!entry || !info) {
    return (
      <MobileScreen>
        <MText>Inicie una operación para registrar merma.</MText>
      </MobileScreen>
    );
  }

  const save = () => {
    const amount = parseNumber(kg);
    const result = recordWaste(info.stage.id, user.id, amount, destination);
    if (!result.ok) {
      setErrors(result.errors);
      return showToast('error', 'Revise los datos ingresados');
    }
    if (result.value.alert) {
      showToast('error', `Merma de la orden en ${formatPercent(result.value.fraction)}: supera el máximo, se avisó al supervisor`, 6000);
    } else {
      showToast('success', `Merma guardada: ${formatKg(amount)} (${wasteDestinationLabels[destination!]})`);
    }
    router.back();
  };

  return (
    <MobileScreen footer={<Button title="Guardar" size="lg" onPress={save} testID="save-waste" />}>
      <MTitle>
        {stageLabels[info.stage.type]} · {info.order.code}
      </MTitle>
      <PadField testID="field-waste" label="Merma" unit="kg" value={kg} active onPress={() => undefined} error={errors.kg} />
      <NumberPad
        value={kg}
        onChange={(v) => {
          setKg(v);
          setErrors((e) => ({ ...e, kg: '' }));
        }}
      />
      <Segmented
        label="Destino"
        large
        value={destination}
        options={DESTINATIONS}
        onChange={(v) => {
          setDestination(v);
          setErrors((e) => ({ ...e, destination: '' }));
        }}
        error={errors.destination}
        testID="destination"
      />
    </MobileScreen>
  );
}
