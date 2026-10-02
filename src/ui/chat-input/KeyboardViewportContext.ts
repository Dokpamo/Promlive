import {createContext} from 'react';
import type {KeyboardViewport} from './keyboardViewport';
export const KeyboardViewportContext = createContext<KeyboardViewport | null>(null);
