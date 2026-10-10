import { useCallback, useEffect, useRef, useState } from 'react';
import { type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Page } from '../features/complaints/types';
import type { CivicDomain } from '../data/civic';
export function useScrollChrome(page: Page, domain: CivicDomain) {
  const [homeHeaderHeight, setHomeHeaderHeight] = useState(66);
  const [heroHeight, setHeroHeight] = useState(288);
  const scrollScope = `${page}:${domain}`;
  const heroScrollY = useSharedValue(0);
  useEffect(() => { heroScrollY.set(0); }, [scrollScope, heroScrollY]);
  const scrollAnchor = useRef({ scope: scrollScope, y: 0 });
  const [navVisibility, setNavVisibility] = useState({ scope: scrollScope, hidden: false });
  if (navVisibility.scope !== scrollScope) setNavVisibility({ scope: scrollScope, hidden: false });
  const navHidden = navVisibility.scope === scrollScope && navVisibility.hidden;
  const [heroVisibility, setHeroVisibility] = useState({ scope: scrollScope, compact: false });
  if (heroVisibility.scope !== scrollScope) setHeroVisibility({ scope: scrollScope, compact: false });
  const heroCompact = heroVisibility.scope === scrollScope && heroVisibility.compact;
  const [refreshPosition, setRefreshPosition] = useState({ scope: scrollScope, atTop: true });
  const refreshAtTop = refreshPosition.scope !== scrollScope || refreshPosition.atTop;
  const onScrollPosition = useCallback((y: number) => {
    const atTop = y <= 0;
    setRefreshPosition(current => current.scope === scrollScope && current.atTop === atTop ? current : { scope: scrollScope, atTop });
    if (y >= 216 || y <= 32) {
      const compact = y >= 216;
      setHeroVisibility(current => current.scope === scrollScope && current.compact === compact ? current : { scope: scrollScope, compact });
    }
    if (scrollAnchor.current.scope !== scrollScope) scrollAnchor.current = { scope: scrollScope, y: 0 };
    const delta = y - scrollAnchor.current.y;
    if (y <= 8 || delta >= 48 || delta <= -10) {
      const hidden = y > 8 && delta > 0;
      scrollAnchor.current.y = y;
      setNavVisibility(current => current.scope === scrollScope && current.hidden === hidden ? current : { scope: scrollScope, hidden });
    }
  }, [scrollScope]);
  const onContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    onScrollPosition(Math.max(0, Math.min(contentOffset.y, Math.max(0, contentSize.height - layoutMeasurement.height))));
  }, [onScrollPosition]);
  const onTrackerScroll = useAnimatedScrollHandler(event => {
    const y = Math.max(0, Math.min(event.contentOffset.y, Math.max(0, event.contentSize.height - event.layoutMeasurement.height)));
    heroScrollY.set(y);
    scheduleOnRN(onScrollPosition, y);
  });
  return { homeHeaderHeight, setHomeHeaderHeight, heroHeight, setHeroHeight, heroScrollY,
    navHidden, heroCompact, refreshAtTop, onContentScroll, onTrackerScroll };
}
