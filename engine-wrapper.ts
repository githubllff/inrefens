// engine-wrapper.ts

import { App } from 'obsidian';
// @ts-expect-error
import * as wasmModuleUntyped from './engine.js';
// @ts-expect-error
import wasmBinary from './engine_bg.wasm';
import { Citation, InrefensEngineInstance, InrefensEngineModule, LanguageInfo } from './types';

const wasmModule = wasmModuleUntyped as unknown as InrefensEngineModule;

let engineInitialized = false;
let engineInstance: InrefensEngineInstance | null = null;
let cachedLanguages: LanguageInfo[] | null = null;

// ──────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────
// NOTE: This fork disables the upstream integrity check. The original
// engine verifies a hash derived from the unmodified upstream main.js,
// which prevents any modified fork from initialising.

export async function initEngine(app: App, language: string): Promise<void> {
    if (engineInitialized) return;

    await wasmModule.default({ module_or_path: wasmBinary });

    const travertureEnabled = isPluginEnabled(app, 'traverture');
    const instance = new wasmModule.InrefensEngine(language, travertureEnabled);

    engineInstance = instance;
    engineInitialized = true;
}

function isPluginEnabled(app: App, pluginId: string): boolean {
    const plugins = (app as unknown as {
        plugins?: { enabledPlugins?: Set<string> };
    }).plugins;
    return plugins?.enabledPlugins?.has(pluginId) ?? false;
}

export function isEngineReady(): boolean {
    return engineInitialized && engineInstance !== null;
}

export function resetEngine(): void {
    engineInstance = null;
    engineInitialized = false;
    cachedLanguages = null;
}

// ──────────────────────────────────────────────
// Engine access
// ──────────────────────────────────────────────

export function findCitations(text: string): Citation[] | null {
    if (!engineInstance) return null;
    try {
        const json = engineInstance.find_citations(text);
        return JSON.parse(json) as Citation[];
    } catch (e) {
        console.error('in(REF)ens: failed to parse citations:', e);
        return null;
    }
}

export function buildDelimitedUrl(text: string): string {
    if (!engineInstance) return '';
    try {
        return engineInstance.build_delimited_url(text);
    } catch {
        return '';
    }
}

export function getDelimitedQuery(text: string): string {
    if (!engineInstance) return '';
    try {
        return engineInstance.get_delimited_query(text);
    } catch {
        return '';
    }
}

export function buildWolUrl(query: string): string {
    if (!engineInstance) return '';
    try {
        return engineInstance.build_wol_url_for_query(query);
    } catch {
        return '';
    }
}

export function getEngineVersion(): string {
    if (!engineInitialized) return 'Engine not initialized';
    try {
        return wasmModule.InrefensEngine.get_version();
    } catch {
        return 'Unknown';
    }
}

function getAvailableLanguages(): LanguageInfo[] {
    if (!engineInitialized) return [];
    try {
        const json = wasmModule.InrefensEngine.get_available_languages();
        return JSON.parse(json) as LanguageInfo[];
    } catch {
        return [];
    }
}

export function getAvailableLanguagesCached(): LanguageInfo[] {
    if (!cachedLanguages) {
        cachedLanguages = getAvailableLanguages();
    }
    return cachedLanguages;
}
