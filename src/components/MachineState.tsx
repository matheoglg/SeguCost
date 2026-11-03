import { pauseTypeLabels } from '@/domain/labels';
import type { MachineStatus } from '@/domain/production';
import { colors } from '@/theme';
import { StatusBadge, type Tone } from './StatusBadge';

/** Label, badge tone and accent color for a machine state (RF-25). */
export function machineStateView(status: MachineStatus): { label: string; tone: Tone; color: string } {
  if (status.state === 'operating') return { label: 'Operando', tone: 'success', color: colors.success };
  if (status.state === 'paused')
    return { label: `En pausa · ${pauseTypeLabels[status.pauseType!].toLowerCase()}`, tone: status.pauseType === 'rest' ? 'rest' : 'warning', color: status.pauseType === 'rest' ? colors.rest : colors.warning };
  return { label: 'Detenida', tone: 'neutral', color: colors.idle };
}

export function MachineStateBadge({ status, large }: { status: MachineStatus; large?: boolean }) {
  const v = machineStateView(status);
  return <StatusBadge label={v.label} tone={v.tone} large={large} />;
}
