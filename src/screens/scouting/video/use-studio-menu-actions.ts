import { useLayoutEffect, useRef } from 'react';
import type { StudioMenuAction } from './types';

/** Publish capabilities, without sending playback renders back to the workspace. */
export function useStudioMenuActions(identity: string, actions: StudioMenuAction[], onChange?: (actions: StudioMenuAction[] | null) => void) {
    const latest = useRef(actions);
    useLayoutEffect(() => { latest.current = actions; });
    const shape = JSON.stringify(actions.map(({ onPress: _onPress, ...item }) => item));
    useLayoutEffect(() => {
        if (!onChange) return;
        const items: Omit<StudioMenuAction, 'onPress'>[] = JSON.parse(shape);
        onChange(items.map(item => ({ ...item, onPress: () => {
            const action = latest.current.find(value => value.id === item.id);
            if (action && !action.disabled) action.onPress();
        } })));
        return () => onChange(null);
    }, [identity, shape, onChange]);
}
