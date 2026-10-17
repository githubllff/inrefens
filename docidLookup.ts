// docidLookup.ts

import { requestUrl } from 'obsidian';

let docidCache: Record<string, string> = {};
let persistCache: (() => Promise<void>) | null = null;
let pluginLanguage = 'en';

// Common mappings from inrefens/WOL language codes to JW.org locales.
// English is the default because it is the most complete search locale.
const JW_LOCALE_MAP: Record<string, string> = {
    en: 'E',
    es: 'S',
    fr: 'F',
    de: 'D',
    it: 'I',
    pt: 'T',
    nl: 'O',
    pl: 'M',
    ru: 'X',
    uk: 'K',
};

export function setPluginLanguage(languageCode: string): void {
    pluginLanguage = languageCode || 'en';
}

export function getPluginLanguage(): string {
    return pluginLanguage;
}

export function configureDocidCache(
    store: Record<string, string>,
    persist: () => Promise<void>,
): void {
    docidCache = store;
    persistCache = persist;
}

export function buildJwOrgFinderUrl(
    docid: string,
    locale = 'E',
    paragraph?: string | number | null,
): string {
    let url = `https://www.jw.org/finder?srcid=jwlshare&wtlocale=${locale}&prefer=lang&docid=${docid}`;

    if (paragraph !== undefined && paragraph !== null && String(paragraph).trim() !== '') {
        url += `&par=${paragraph}`;
    }

    return url;
}

export async function lookupDocid(query: string): Promise<string | null> {
    const trimmedQuery = (query || '').trim();
    if (!trimmedQuery) return null;

    const cacheKey = `${pluginLanguage}:${trimmedQuery}`;
    const cached = docidCache[cacheKey];
    if (cached) {
        console.debug('in(REF)ens: using cached docid for', trimmedQuery, cached);
        return cached;
    }

    const locale = JW_LOCALE_MAP[pluginLanguage] ?? 'E';
    const searchUrl = `https://www.jw.org/${locale}/search/?q=${encodeURIComponent(trimmedQuery)}`;

    console.debug('in(REF)ens: JW.org docid lookup:', {
        query: trimmedQuery,
        language: pluginLanguage,
        locale,
        searchUrl,
    });

    try {
        const response = await requestUrl({
            url: searchUrl,
            method: 'GET',
        });

        console.debug('in(REF)ens: JW.org response status:', response.status);

        const match = response.text.match(/[?&]docid=(\d+)/);
        console.debug('in(REF)ens: docid match:', match ? match[1] : null);

        if (match) {
            const docid = match[1];
            docidCache[cacheKey] = docid;

            if (persistCache) {
                try {
                    await persistCache();
                } catch (e) {
                    console.warn('in(REF)ens: could not persist docid cache:', e);
                }
            }

            return docid;
        }

        console.debug(
            'in(REF)ens: no docid found in JW.org response. First 1000 characters:\n',
            response.text.slice(0, 1000),
        );
    } catch (e) {
        console.warn('in(REF)ens: JW.org docid lookup failed:', e);
    }

    return null;
}
