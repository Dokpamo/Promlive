import {createContext, useContext} from 'react';
import {AiCatalogCache} from './aiCatalogCache';

export const AiCatalogContext = createContext(new AiCatalogCache());
export const useAiCatalogCache = () => useContext(AiCatalogContext);
