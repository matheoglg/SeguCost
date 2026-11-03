import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme';

/** True on office screens (>= 1024 px), where the web shell shows the fixed sidebar. */
export function useIsWide(): boolean {
  return useWindowDimensions().width >= layout.wideBreakpoint;
}
