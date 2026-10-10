import type { EdgeInsets } from 'react-native-safe-area-context';
import type { useScrollChrome } from '../../../hooks/useScrollChrome';
export type ScreenChrome = ReturnType<typeof useScrollChrome> & { insets: EdgeInsets };
