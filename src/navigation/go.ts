import { router, type Href } from 'expo-router';

/** Navigates to a concrete path built at runtime (typed routes cannot check dynamic strings). */
export const go = (path: string) => router.push(path as Href);
