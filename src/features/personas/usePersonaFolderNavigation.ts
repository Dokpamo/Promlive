import {useEffect, useRef, useState} from 'react';
import {Animated, Platform} from 'react-native';
import {useItemReducedMotion} from '../../layout/itemListMotion';
import {panelSpringForDistance} from '../../layout/panelAnimation';
import type {SheetDrag} from '../../layout/SwipeBackModal';
import {personaFolderPath, type PersonaCollection} from './personaPreferences';

type Route = {trail: (string | null)[]; index: number};
type Transition = {from: string | null; to: string | null; direction: 1 | -1};
const current = (route: Route) => route.trail[route.index] ?? null;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** The picker stays mounted; only its folder contents travel with the finger. */
export function usePersonaFolderNavigation({value, initialFolderId, blocked, canVisit, width}: {
  value: PersonaCollection; initialFolderId: string | null; blocked: boolean;
  canVisit: (id: string | null) => boolean; width: number;
}) {
  const [route, setRoute] = useState<Route>(() => {
    const trail = [null, ...personaFolderPath(value, initialFolderId).map(folder => folder.id)];
    return {trail, index: trail.length - 1};
  });
  const routeRef = useRef(route);
  const [transition, setTransition] = useState<Transition | null>(null);
  const transitionRef = useRef(transition);
  const [dragging, setDragging] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const reduced = useItemReducedMotion();
  const latest = useRef({value, blocked, canVisit, width, reduced});
  latest.current = {value, blocked, canVisit, width, reduced};
  const gesture = useRef<{next: Route; endpoint: 0 | 1; origin: number; captured: number; delta: number; direction: 1 | -1} | null>(null);

  useEffect(() => {
    mounted.current = true;
    const listener = progress.addListener(({value}) => {position.current = value;});
    return () => {mounted.current = false; generation.current++; progress.stopAnimation(); progress.removeListener(listener);};
  }, [progress]);

  const commit = (next: Route) => {routeRef.current = next; setRoute(next);};
  const valid = (id: string | null) => latest.current.canVisit(id) && (id === null || latest.current.value.folders.some(folder => folder.id === id));
  const step = (delta: number) => {
    const before = routeRef.current, index = before.index + delta;
    return index >= 0 && index < before.trail.length && valid(before.trail[index]!) ? {...before, index} : null;
  };
  const prepare = (next: Route): 0 | 1 => {
    const from = current(routeRef.current), to = current(next), existing = transitionRef.current;
    // Reversing an in-flight transition uses its displayed position, not a new page.
    if (existing && (to === existing.from || to === existing.to) && (from === existing.from || from === existing.to)) return to === existing.to ? 1 : 0;
    generation.current++;
    progress.stopAnimation(); progress.setValue(0); position.current = 0;
    const motion: Transition = {from, to, direction: next.index < routeRef.current.index ? -1 : 1};
    transitionRef.current = motion; setTransition(motion);
    return 1;
  };
  const settle = (endpoint: 0 | 1) => {
    const attempt = ++generation.current;
    gesture.current = null; setDragging(false); progress.stopAnimation();
    const finish = () => {
      if (!mounted.current || attempt !== generation.current) return;
      transitionRef.current = null; setTransition(null);
    };
    if (latest.current.reduced) {progress.setValue(endpoint); finish(); return;}
    Animated.spring(progress, {...panelSpringForDistance(latest.current.width), toValue: endpoint, useNativeDriver: Platform.OS !== 'web'})
      .start(({finished}) => {if (finished) finish();});
  };
  const navigate = (id: string | null) => {
    if (latest.current.blocked || !valid(id) || id === current(routeRef.current)) return;
    const before = routeRef.current;
    const previous = before.trail.slice(0, before.index).indexOf(id);
    const next = previous >= 0 ? {...before, index: previous}
      : before.trail[before.index + 1] === id ? {...before, index: before.index + 1}
      : {trail: [...before.trail.slice(0, before.index + 1), id], index: before.index + 1};
    const endpoint = prepare(next);
    commit(next); settle(endpoint);
  };
  const moveFinger = () => {
    const drag = gesture.current;
    if (drag) {
      const next = clamp(drag.origin - drag.direction * (drag.captured + drag.delta) / latest.current.width);
      position.current = next; progress.setValue(next);
    }
  };
  // A stable object is also safe for a native gesture that spans React renders.
  const callbacks = useRef<SheetDrag>(null);
  callbacks.current = {
    canStart: () => !latest.current.blocked,
    begin: dx => {
      if (latest.current.blocked) return;
      const next = step(dx > 0 ? -1 : 1);
      if (!next) {gesture.current = null; return;}
      const endpoint = prepare(next), motion = transitionRef.current!;
      const attempt = ++generation.current;
      gesture.current = {next, endpoint, origin: position.current, captured: dx, delta: 0, direction: motion.direction};
      setDragging(true);
      progress.stopAnimation(displayed => {
        if (!gesture.current || attempt !== generation.current) return;
        gesture.current.origin = displayed;
        moveFinger();
      });
      moveFinger();
    },
    move: dx => {if (gesture.current) {gesture.current.delta = dx; moveFinger();}},
    release: (dx, _dy, vx, _vy, cancelled) => {
      const drag = gesture.current;
      if (!drag) return;
      const distance = drag.captured + dx;
      const sign = drag.endpoint === 1 ? -drag.direction : drag.direction;
      const complete = !cancelled && !latest.current.blocked && valid(current(drag.next)) && vx * sign > -0.45
        && (distance * sign >= latest.current.width * 0.25 || (distance * sign >= 18 && vx * sign >= 0.45));
      if (complete) commit(drag.next);
      settle(complete ? drag.endpoint : current(routeRef.current) === transitionRef.current?.to ? 1 : 0);
    },
  };
  const drag = useRef<SheetDrag>({
    canStart: () => callbacks.current!.canStart(),
    begin: (...args) => callbacks.current!.begin(...args),
    move: (...args) => callbacks.current!.move(...args),
    release: (...args) => callbacks.current!.release(...args),
  }).current;
  return {
    folderId: current(route), navigate, drag, dragging, transition,
    back: () => {
      if (latest.current.blocked) return true;
      const previous = step(-1);
      if (!previous) return false;
      navigate(current(previous)); return true;
    },
    incoming: {transform: [{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [(transition?.direction ?? 1) * width, 0]})}]},
    outgoing: {transform: [{translateX: progress.interpolate({inputRange: [0, 1], outputRange: [0, -(transition?.direction ?? 1) * width]})}]},
  };
}
