// main.ts

import { Plugin, MarkdownView } from 'obsidian';
import { createInrefensEditorPlugin, requestInrefensFullRescan } from './editor';
import { initEngine, isEngineReady, resetEngine, buildWolUrl } from './engine-wrapper';
import { processElement } from './post-processor';
import { InrefensSettingTab } from './settings';
import { configureDocidCache, setPluginLanguage } from './docidLookup';
import { setOpenInJWLibrary } from './linkOpener';
import { DEFAULT_SETTINGS, InrefensSettings } from './types';

export default class InrefensPlugin extends Plugin {
    settings: InrefensSettings = DEFAULT_SETTINGS;

    async loadSettings() {
        const saved = await this.loadData() as Partial<InrefensSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

        if (!this.settings.docidCache || typeof this.settings.docidCache !== 'object') {
            this.settings.docidCache = {};
        }

        setOpenInJWLibrary(this.settings.openInJWLibrary);
        setPluginLanguage(this.settings.language);
        configureDocidCache(this.settings.docidCache, () => this.saveSettings());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        setOpenInJWLibrary(this.settings.openInJWLibrary);
    }

    async reloadEngine(): Promise<void> {
        resetEngine();
        try {
            await initEngine(this.app, this.settings.language);
        } catch (e) {
            console.error('in(REF)ens: engine re-initialization failed:', e);
            return;
        }
        this.refreshReadingViewLinks();
        this.refreshEditorDecorations();
    }

    refreshReadingViewLinksForSettings(): void {
        this.refreshReadingViewLinks();
    }

    private refreshEditorDecorations(): void {
        requestInrefensFullRescan();
        this.app.workspace.iterateAllLeaves(leaf => {
            const view = leaf.view;
            if (!(view instanceof MarkdownView)) return;
            const editorView = (view.editor as unknown as { cm?: unknown }).cm;
            const cmView = editorView as { dispatch?: (spec: unknown) => void } | undefined;
            if (cmView?.dispatch) {
                cmView.dispatch({});
            }
        });
    }

    private refreshReadingViewLinks(): void {
        this.app.workspace.iterateAllLeaves(leaf => {
            const container = leaf.view.containerEl;
            if (!container) return;
            container.querySelectorAll('.inrefens-link[data-inrefens-query]').forEach(el => {
                const query = el.getAttribute('data-inrefens-query');
                if (!query) return;
                const wolUrl = buildWolUrl(query);
                if (wolUrl && el.instanceOf(HTMLAnchorElement)) {
                    el.href = wolUrl;
                }
            });
        });
    }

    applyLinkColor(): void {
        const color = this.settings.linkColor;
        const root = activeDocument.documentElement;
        if (color && color.trim() !== '') {
            root.style.setProperty('--inrefens-link-color', color.trim());
        } else {
            root.style.removeProperty('--inrefens-link-color');
        }
    }

    async onload() {
        await this.loadSettings();
        this.applyLinkColor();

        try {
            await initEngine(this.app, this.settings.language);
        } catch (e) {
            console.error('in(REF)ens: engine initialization failed:', e);
        }

        this.addSettingTab(new InrefensSettingTab(this.app, this));
        this.registerEditorExtension(createInrefensEditorPlugin());
        this.registerMarkdownPostProcessor(processElement);

        setTimeout(() => {
            this.app.workspace.iterateAllLeaves(leaf => {
                const container = leaf.view?.containerEl;
                if (!container) return;
                container.querySelectorAll('.inrefens-processed').forEach(el => el.classList.remove('inrefens-processed'));
                try { processElement(container); } catch {}
            });
        }, 250);

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'characterData') {
                    const parent = m.target.parentElement;
                    if (parent) processElement(parent);
                    continue;
                }
                for (const node of Array.from(m.addedNodes)) {
                    if (node instanceof HTMLElement) {
                        processElement(node);
                    }
                }
            }
        });
        observer.observe(activeDocument.body, { childList: true, subtree: true, characterData: true });
        this.register(() => observer.disconnect());

        if (!isEngineReady()) {
            console.warn('in(REF)ens: engine not ready!');
        }
    }

    onunload() {
        resetEngine();
    }
}
