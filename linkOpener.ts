// linkOpener.ts

import { buildJwOrgFinderUrl, lookupDocid } from './docidLookup';

let openInJWLibrary = false;

export function setOpenInJWLibrary(enabled: boolean): void {
    openInJWLibrary = enabled;
}

export function isOpenInJWLibraryEnabled(): boolean {
    return openInJWLibrary;
}

export function getReferenceUrl(wolUrl: string, query: string): string {
    // The anchor href remains WOL. When JW Library mode is enabled, the
    // click handlers resolve a docid asynchronously and open the JW.org
    // finder share URL instead.
    return wolUrl;
}

export async function openReferenceAsync(
    wolUrl: string,
    query: string,
): Promise<void> {
    if (openInJWLibrary && query.trim()) {
        const docid = await lookupDocid(query);

        if (docid) {
            window.open(buildJwOrgFinderUrl(docid), '_blank');
            return;
        }
    }

    window.open(wolUrl, '_blank');
}
