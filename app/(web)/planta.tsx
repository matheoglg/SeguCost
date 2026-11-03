// W-10 Monitor de planta (RF-25). Reads the same store the phones write to, refreshed every 5 s.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/Inputs';
import { MachineStateBadge, machineStateView } from '@/components/MachineState';
import { Card, Note, Page, Row } from '@/components/web/Page';
import { sectionLabels, stageLabels } from '@/domain/labels';
import { machineStatus, orderWaste } from '@/domain/production';
import type { MachineSection } from '@/domain/types';
import { formatElapsed, formatPercent, formatTime } from '@/format';
import { useNow } from '@/hooks/useNow';
import { go } from '@/navigation/go';
import { useDataStore } from '@/store/data';
import { stageInfo, userName } from '@/store/selectors';
import { colors, font, radius, spacing } from '@/theme';

type Filter = MachineSection | 'all';

export default function PlantMonitorScreen() {
  const db = useDataStore((s) => s.db);
  const now = useNow(5000);
  const [filter, setFilter] = useState<Filter>('all');
  const machines = db.machines.filter((m) => m.active && (filter === 'all' || m.section === filter));
  const statuses = db.machines.map((m) => machineStatus(db, m.id));
  const count = (state: string) => statuses.filter((s) => s.state === state).length;
  const alerts = db.orders.filter((o) => (o.status === 'inProgress' || o.status === 'toValidate') && orderWaste(db, o.id).alert);

  return (
    <Page>
      <Row align="center">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'Todas las secciones' }, ...(Object.keys(sectionLabels) as MachineSection[]).map((s) => ({ value: s, label: sectionLabels[s] }))]}
          testID="section-filter"
        />
        <View style={{ flex: 1 }} />
        <Text style={styles.updated} testID="last-update">
          Última actualización: {formatTime(now.toISOString())}:{String(now.getSeconds()).padStart(2, '0')}
        </Text>
      </Row>
      <Text style={styles.summary}>
        {count('operating')} operando · {count('paused')} en pausa · {count('stopped')} detenidas
      </Text>

      {alerts.map((o) => (
        <Pressable key={o.id} onPress={() => go(`/ordenes/${o.id}`)} accessibilityRole="link">
          <Note tone="alert">
            Merma excedida en {o.code}: {formatPercent(orderWaste(db, o.id).fraction)} (máximo {formatPercent(db.settings.maxWastePct, 0)}). Clic para revisar la orden.
          </Note>
        </Pressable>
      ))}

      <View style={styles.grid}>
        {machines.map((m) => {
          const status = machineStatus(db, m.id);
          const view = machineStateView(status);
          const info = status.entry && stageInfo(db, status.entry.stageId);
          return (
            <Pressable
              key={m.id}
              testID={`machine-${m.code}`}
              disabled={!info}
              onPress={() => info && go(`/ordenes/${info.order.id}`)}
              style={(s) => [styles.machine, { borderTopColor: view.color }, (s as { hovered?: boolean }).hovered && info && styles.hover]}
            >
              <View style={styles.machineHead}>
                <Text style={styles.code}>{m.code}</Text>
                <Text style={styles.section}>{sectionLabels[m.section]}</Text>
              </View>
              <MachineStateBadge status={status} large />
              <Text style={styles.label}>Operario</Text>
              <Text style={styles.value}>{status.entry ? userName(db, status.entry.operatorId) : '—'}</Text>
              <Text style={styles.label}>Orden en curso</Text>
              <Text style={styles.value}>{info ? `${info.order.code} · ${stageLabels[info.stage.type]} · ${info.product.code}` : '—'}</Text>
              <Text style={styles.label}>Tiempo en el estado</Text>
              <Text style={styles.time}>{status.since ? formatElapsed(now.getTime() - new Date(status.since).getTime()) : '—'}</Text>
            </Pressable>
          );
        })}
      </View>
      <Card>
        <Text style={styles.updated}>
          El monitor lee las marcaciones que envían los celulares de planta. En la demostración, web y móvil comparten los datos, así que un cambio en la app se refleja aquí en
          menos de 5 segundos (RNF-07 pide máximo 60).
        </Text>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  updated: { fontSize: font.size.sm, color: colors.textMuted },
  summary: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  machine: {
    width: 300,
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 6,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  hover: { borderColor: colors.primaryLight },
  machineHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs },
  code: { fontSize: font.size.xxl, fontWeight: font.weight.bold, color: colors.primary },
  section: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold },
  label: { fontSize: 12, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'uppercase', marginTop: spacing.sm },
  value: { fontSize: font.size.md, color: colors.text },
  time: { fontSize: font.size.lg, color: colors.text, fontWeight: font.weight.bold, fontVariant: ['tabular-nums'] },
});
