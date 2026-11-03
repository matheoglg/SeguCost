// M-06 Cierre en empacado (RF-18). Final count and bundles; the order goes to "Por validar".
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { MCard, MobileScreen, MText, MTitle } from '@/components/mobile/Mobile';
import { NumberPad, PadField } from '@/components/mobile/NumberPad';
import { showToast } from '@/components/Toast';
import { countDifference } from '@/domain/production';
import { formatNumber, parseNumber } from '@/format';
import { closeAtPacking } from '@/store/actions';
import { useDataStore } from '@/store/data';
import { runningEntry, stageInfo } from '@/store/selectors';
import { useCurrentUser } from '@/store/session';
import { colors, font, spacing } from '@/theme';

const DIFFERENCE = {
  short: { label: 'Faltan', color: colors.alert },
  over: { label: 'Sobran', color: colors.warning },
  exact: { label: 'Completo', color: colors.success },
};

export default function PackingCloseScreen() {
  const user = useCurrentUser()!;
  const db = useDataStore((s) => s.db);
  const entry = runningEntry(db, user.id);
  const info = entry && stageInfo(db, entry.stageId);
  const [values, setValues] = useState({ count: '', bundles: '' });
  const [active, setActive] = useState<'count' | 'bundles'>('count');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!entry || !info || info.stage.type !== 'packing') {
    return (
      <MobileScreen>
        <MText>El cierre se hace desde una operación de empacado en curso.</MText>
      </MobileScreen>
    );
  }

  const ordered = info.salesOrder.quantity;
  const count = parseNumber(values.count);
  const bundles = parseNumber(values.bundles);
  const ready = count > 0 && bundles > 0;
  const diff = count > 0 ? countDifference(ordered, count) : undefined;
  const diffStyle = diff && DIFFERENCE[diff.kind];

  const close = () => {
    const result = closeAtPacking(info.order.id, user.id, count, bundles);
    if (!result.ok) {
      setErrors(result.errors);
      return showToast('error', Object.values(result.errors)[0]);
    }
    showToast('success', `${info.order.code} cerrada: queda Por validar`);
    router.replace('/m/turno');
  };

  return (
    <MobileScreen footer={<Button title="Cerrar orden" size="lg" disabled={!ready} onPress={close} testID="close-order" />}>
      <MTitle>
        {info.order.code} · {info.product.code}
      </MTitle>
      <MCard>
        <View style={styles.summary}>
          <View style={styles.flex}>
            <MText muted>Cantidad pedida</MText>
            <Text style={styles.big}>{formatNumber(ordered)}</Text>
          </View>
          <View style={styles.flex}>
            <MText muted>Diferencia</MText>
            <Text style={[styles.big, diffStyle && { color: diffStyle.color }]} testID="difference">
              {diff ? (diff.kind === 'exact' ? diffStyle!.label : `${diffStyle!.label} ${formatNumber(diff.amount)}`) : '—'}
            </Text>
          </View>
        </View>
      </MCard>
      <View style={styles.fields}>
        <PadField testID="field-count" label="Conteo final" unit="u" value={values.count} active={active === 'count'} onPress={() => setActive('count')} error={errors.finalCount} />
        <PadField testID="field-bundles" label="Bultos" unit="" value={values.bundles} active={active === 'bundles'} onPress={() => setActive('bundles')} error={errors.bundles} />
      </View>
      <NumberPad value={values[active]} decimals={false} onChange={(v) => setValues((s) => ({ ...s, [active]: v }))} />
    </MobileScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', gap: spacing.md },
  big: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  fields: { flexDirection: 'row', gap: spacing.md },
});
