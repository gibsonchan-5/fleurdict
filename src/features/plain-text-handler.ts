/**
 * Plain-text file handler (txt / json / yaml / xml, etc.)
 * Uses DOM selection + custom Menu — these views do not fire editor-menu.
 */

import type { Plugin } from 'obsidian';
import {
  getWordAtClickPoint,
  showFleurDictMenuAt,
} from './context-menu';
import type { SelectionHandler } from './selection-handler';

/** Vault extensions treated as in-app plain text (opened via Data Files Editor, etc.) */
export const PLAIN_TEXT_EXTENSIONS = new Set([
  'txt',
  'json',
  'yaml',
  'yml',
  'xml',
]);

export class PlainTextHandler {
  private plugin: Plugin;
  private selectionHandler: SelectionHandler;
  private dblclickHandler: ((evt: MouseEvent) => void) | null = null;
  private contextmenuHandler: ((evt: MouseEvent) => void) | null = null;

  constructor(plugin: Plugin, selectionHandler: SelectionHandler) {
    this.plugin = plugin;
    this.selectionHandler = selectionHandler;
  }

  private isPlainTextFile(): boolean {
    const file = this.plugin.app.workspace.getActiveFile();
    if (!file) return false;
    return PLAIN_TEXT_EXTENSIONS.has(file.extension.toLowerCase());
  }

  private resolveText(evt: MouseEvent): string | null {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || '';
    if (selected) return selected;
    return getWordAtClickPoint(evt);
  }

  register(): void {
    this.dblclickHandler = (evt: MouseEvent) => {
      if (!this.isPlainTextFile()) return;

      const word = getWordAtClickPoint(evt);
      if (!word) return;

      evt.preventDefault();
      evt.stopPropagation();
      this.selectionHandler.lookupWord(word);
    };

    this.contextmenuHandler = (evt: MouseEvent) => {
      if (!this.isPlainTextFile()) return;

      const text = this.resolveText(evt);
      if (!text || !/[a-zA-Z]/.test(text)) return;

      evt.preventDefault();
      evt.stopPropagation();

      showFleurDictMenuAt(
        this.plugin,
        this.selectionHandler,
        evt.clientX,
        evt.clientY,
        text,
        { stripMarkdown: false }
      );
    };

    document.addEventListener('dblclick', this.dblclickHandler, true);
    document.addEventListener('contextmenu', this.contextmenuHandler, true);
  }

  unregister(): void {
    if (this.dblclickHandler) {
      document.removeEventListener('dblclick', this.dblclickHandler, true);
      this.dblclickHandler = null;
    }
    if (this.contextmenuHandler) {
      document.removeEventListener('contextmenu', this.contextmenuHandler, true);
      this.contextmenuHandler = null;
    }
  }
}
