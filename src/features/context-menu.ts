/**
 * FleurDict - Context Menu
 * Registers right-click menu items (Markdown editor-menu + shared builder)
 */

import { Plugin, Menu, MenuItem } from 'obsidian';
import { FleurDictSettings } from '../types';
import { SelectionHandler } from './selection-handler';

export interface PreparedSelection {
  /** Original selection (used for AI translate / detail) */
  fullSelection: string;
  /** Cleaned word/phrase (used for lookup / wordbook) */
  cleanWord: string;
}

/**
 * Strip common Markdown markers and extract an English word/phrase.
 * Returns null when the selection has no English letters.
 */
export function prepareSelectionText(raw: string, stripMarkdown = true): PreparedSelection | null {
  const fullSelection = raw.trim();
  if (!fullSelection || !/[a-zA-Z]/.test(fullSelection)) {
    return null;
  }

  let cleaned = fullSelection;
  if (stripMarkdown) {
    cleaned = cleaned
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`/g, '')
      .trim();
  }

  const match = cleaned.match(/[a-zA-Z][a-zA-Z'\-\s,;:!?]*[a-zA-Z']?/);
  const cleanWord = (match ? match[0].trim() : cleaned) || fullSelection;

  return { fullSelection, cleanWord };
}

/**
 * Append FleurDict actions to an Obsidian Menu.
 * Returns true when items were added.
 */
export function appendFleurDictMenuItems(
  menu: Menu,
  plugin: Plugin,
  selectionHandler: SelectionHandler,
  rawText: string,
  options?: { stripMarkdown?: boolean }
): boolean {
  const prepared = prepareSelectionText(rawText, options?.stripMarkdown !== false);
  if (!prepared) {
    return false;
  }

  const { fullSelection, cleanWord } = prepared;
  console.log('FleurDict: Adding menu items for:', cleanWord, '| full selection:', fullSelection);

  menu.addSeparator();

  menu.addItem((item: MenuItem) => {
    item
      .setTitle('FleurDict 查词')
      .setIcon('book-open')
      .onClick(() => {
        selectionHandler.lookupWord(cleanWord);
      });
  });

  menu.addItem((item: MenuItem) => {
    item
      .setTitle('加入生词本')
      .setIcon('bookmark')
      .onClick(() => {
        plugin.app.workspace.trigger('fleurdict:add-to-wordbook', cleanWord);
      });
  });

  menu.addItem((item: MenuItem) => {
    item
      .setTitle('AI 翻译')
      .setIcon('languages')
      .onClick(() => {
        plugin.app.workspace.trigger('fleurdict:ai-translate', fullSelection);
      });
  });

  menu.addItem((item: MenuItem) => {
    item
      .setTitle('AI 详解')
      .setIcon('sparkles')
      .onClick(() => {
        plugin.app.workspace.trigger('fleurdict:ai-detail', fullSelection);
      });
  });

  menu.addSeparator();
  return true;
}

/**
 * Show a standalone FleurDict context menu at screen coordinates.
 */
export function showFleurDictMenuAt(
  plugin: Plugin,
  selectionHandler: SelectionHandler,
  x: number,
  y: number,
  rawText: string,
  options?: { stripMarkdown?: boolean }
): boolean {
  const menu = new Menu();
  const added = appendFleurDictMenuItems(menu, plugin, selectionHandler, rawText, options);
  if (!added) {
    return false;
  }
  menu.showAtPosition({ x, y });
  return true;
}

/**
 * Word under mouse via caretRangeFromPoint (preview / PDF text layer / plain DOM).
 */
export function getWordAtClickPoint(evt: MouseEvent): string | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };

  let node: Node | null = null;
  let offset = 0;

  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(evt.clientX, evt.clientY);
    if (!range) return null;
    node = range.startContainer;
    offset = range.startOffset;
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(evt.clientX, evt.clientY);
    if (!pos) return null;
    node = pos.offsetNode;
    offset = pos.offset;
  } else {
    return null;
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  return extractWordAtOffset(node.textContent || '', offset);
}

function extractWordAtOffset(text: string, offset: number): string | null {
  const wordRegex = /[a-zA-Z'-]+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return match[0];
    }
  }
  return null;
}

/**
 * Context menu manager (Markdown edit mode via editor-menu)
 */
export class ContextMenuManager {
  private plugin: Plugin;
  private settings: FleurDictSettings;
  private selectionHandler: SelectionHandler;

  constructor(
    plugin: Plugin,
    settings: FleurDictSettings,
    selectionHandler: SelectionHandler
  ) {
    this.plugin = plugin;
    this.settings = settings;
    this.selectionHandler = selectionHandler;
  }

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-menu', (menu, editor) => {
        this.buildMenu(menu, editor);
      })
    );
  }

  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
  }

  private buildMenu(menu: Menu, editor: any): void {
    const selectedText = editor.getSelection()?.trim() || '';
    console.log('FleurDict: Context menu opened, selected text:', selectedText);

    if (!selectedText) {
      console.log('FleurDict: No valid selection, skipping menu');
      return;
    }

    appendFleurDictMenuItems(menu, this.plugin, this.selectionHandler, selectedText, {
      stripMarkdown: true,
    });
  }
}
