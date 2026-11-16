// Placeholder for screens of later flows (CLAUDE.md section 7), so the sidebar never leads to an error.
import { Text } from 'react-native';

import { Card, Note, Page } from '@/components/web/Page';
import { screenById, type ScreenId } from '@/navigation/screens';
import { colors } from '@/theme';

export function Upcoming({ id }: { id: ScreenId }) {
  const s = screenById[id];
  return (
    <Page title={s.title} subtitle={s.purpose} testID={`screen-${id}`}>
      <Note tone="warning">Esta pantalla se completa con el flujo {s.flow} del prototipo.</Note>
      <Card>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {s.id} · {s.rf.join(', ')}
        </Text>
      </Card>
    </Page>
  );
}
