// citations.ts
//
// Shared citation detection for inrefens. Adapts the engine's find_citations
// with additional handling for markdown markup stripping, non-breaking
// characters, Insight title refs, and ijw* article refs.

import { Citation, CitationParts } from './types';
import { findCitations, buildWolUrl } from './engine-wrapper';

export function detectCitations(original: string): Citation[] {
    // Build clean text: strip underscores/asterisks, normalize NBSP and
    // non-breaking hyphens, and reduce existing markdown links to visible text.
    const cleanChars: string[] = [];
    const cleanToOrig: number[] = [];
    const pushChar = (idx: number) => {
        const ch = original[idx];
        if (ch === '_' || ch === '*') return;
        if (ch === '\u200B' || ch === '\u200C' || ch === '\u200D' || ch === '\uFEFF') return;
        if (ch === '\u00A0') { cleanChars.push(' '); cleanToOrig.push(idx); return; }
        if (ch === '\u2011') { cleanChars.push('-'); cleanToOrig.push(idx); return; }
        cleanChars.push(ch);
        cleanToOrig.push(idx);
    };
    let ci = 0;
    while (ci < original.length) {
        if (original[ci] === '[') {
            const close = original.indexOf(']', ci);
            if (close !== -1 && original[close + 1] === '(') {
                const end = original.indexOf(')', close + 2);
                if (end !== -1) {
                    for (let k = ci + 1; k < close; k++) pushChar(k);
                    ci = end + 1;
                    continue;
                }
            }
        }
        pushChar(ci);
        ci++;
    }
    const cleanText = cleanChars.join('');

    const items: Citation[] = [];
    const seen = new Set<string>();

    // 1. Engine-detected citations (scriptures + publications)
    const pubCits = findCitations(cleanText);
    if (pubCits) {
        for (const cit of pubCits) {
            // Skip insight title refs — handled separately below
            if (cit.parts && cit.parts.title) continue;
            const origStart = cleanToOrig[cit.start];
            const origEnd = cleanToOrig[cit.end - 1] + 1;
            const key = `${origStart}-${origEnd}`;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({
                text: cit.text.replace(/[_*]/g, ''),
                start: origStart,
                end: origEnd,
                family: cit.family,
                root: cit.root,
                parts: cit.parts,
                wol_url: cit.wol_url,
            });
        }
    }

    // 2. Insight title refs: it "Title" ¶N (with optional volume and No. X)
    const titleRefRe = new RegExp('\\bit(-[12])?\\s+[""\u201C\u201D«»]?([A-Za-z][A-Za-z\\s\'-]+?)[""\u201C\u201D«»]?(\\s+No\\.\\s*\\d+)?\\s*(?:[^\\w\\s]+|par\\.?|p\\.?)\\s*(\\d+(?:\\s*[-\u2013]\\s*\\d+)?)', 'g');
    let m: RegExpExecArray | null;
    while ((m = titleRefRe.exec(cleanText)) !== null) {
        const volSpec = m[1] || null;
        const title = m[2].trim();
        const noPart = m[3] ? m[3].trim() : '';
        const para = m[4];
        const firstLetter = title.charAt(0).toUpperCase();
        const vol = volSpec || ((firstLetter >= 'A' && firstLetter <= 'I') ? '-1' : '-2');
        const cleanStart = m.index;
        const cleanEnd = m.index + m[0].length;
        const origStart = cleanToOrig[cleanStart];
        const origEnd = cleanToOrig[cleanEnd - 1] + 1;
        const key = `${origStart}-${origEnd}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const query = noPart
            ? `it${vol} "${title}" ${noPart} \u00B6${para}`
            : `it${vol} "${title}" \u00B6${para}`;
        const url = buildWolUrl(query);
        const parts: CitationParts = {
            root: `it${vol}`,
            query: query,
            title: title,
            volume: parseInt(vol.replace('-', ''), 10),
        };
        items.push({
            text: cleanText.slice(cleanStart, cleanEnd).replace(/[_*]/g, '').trim(),
            start: origStart,
            end: origEnd,
            family: 'insight',
            root: `it${vol}`,
            parts: parts,
            wol_url: url,
        });
    }

    // 3. ijw* article refs: ijwia article 6, ijwbv article 50, etc.
    const ijwArticleRe = /\b(ijw[a-z]{2,4})\s+(?:article\s+)?(\d+)/gi;
    while ((m = ijwArticleRe.exec(cleanText)) !== null) {
        const pubCode = m[1];
        const num = m[2];
        const cleanStart = m.index;
        const cleanEnd = m.index + m[0].length;
        const origStart = cleanToOrig[cleanStart];
        const origEnd = cleanToOrig[cleanEnd - 1] + 1;
        const key = `${origStart}-${origEnd}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const query = `${pubCode} ${num}`;
        const url = buildWolUrl(query);
        const parts: CitationParts = {
            root: pubCode,
            query: query,
        };
        items.push({
            text: cleanText.slice(cleanStart, cleanEnd).replace(/[_*]/g, '').trim(),
            start: origStart,
            end: origEnd,
            family: 'periodicals',
            root: pubCode,
            parts: parts,
            wol_url: url,
        });
    }

    // Sort by position
    items.sort((a, b) => a.start - b.start);
    return items;
}
