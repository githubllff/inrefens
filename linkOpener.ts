// linkOpener.ts

import { buildJwLibraryFinderUrlForReference } from './jwLibraryLink';

let openInJWLibrary = false;

export function setOpenInJWLibrary(enabled: boolean): void {
    openInJWLibrary = enabled;
}

export function isOpenInJWLibraryEnabled(): boolean {
    return openInJWLibrary;
}

export function getReferenceUrl(wolUrl: string, query: string): string {
    const trimmedQuery = (query || '').trim();

    if (openInJWLibrary && trimmedQuery) {
        return buildJwLibraryFinderUrlForReference({
            extra: { query: trimmedQuery },
        });
    }

    return wolUrl;
}
