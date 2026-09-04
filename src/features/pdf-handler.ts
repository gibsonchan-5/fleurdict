/**
 * PDF handler — append FleurDict actions to the existing PDF / PDF++ context menu.
 * Does not call preventDefault (that would hide native / PDF++ items).
 */

import { Menu, Plugin } from 'obsidian';
import { appendFleurDictMenuItems, getWordAtClickPoint } from './context-menu';
import type { SelectionHandler } from './selection-handler';

const PDF_VIEW_SELECTOR = [
  '.pdf-viewer',
  '.pdf-container',
  '.textLayer',
  '.pdfViewer',
  '.obsidian-pdf',
].join(', ');

type MenuShowAtMouseEvent = (evt: MouseEvent) => Menu;
type MenuShowAtPosition = (position: { x: number; y: number }, doc?: Document) => Menu;

export class PdfHandler {
  private plugin: Plugin;
  private selectionHandler: SelectionHandler;
  private dblclickHandler: ((evt: MouseEvent) => void) | null = null;
  /** Menus we already appended to (avoid double items via pdf-menu + show*) */
  private augmentedMenus = new WeakSet<Menu>();
  private originalShowAtMouseEvent: MenuShowAtMouseEvent | null = null;
  private originalShowAtPosition: MenuShowAtPosition | null = null;

  constructor(plugin: Plugin, selectionHandler: SelectionHandler) {
    this.plugin = plugin;
    this.selectionHandler = selectionHandler;
  }

  private isPdfFile(): boolean {
    const file = this.plugin.app.workspace.getActiveFile();
    return !!file && file.extension.toLowerCase() === 'pdf';
  }

  private isInPdfView(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return !!target.closest(PDF_VIEW_SELECTOR);
  }

  private getPdfSelectionText(): string {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || '';
    if (!selected) return '';

    const anchor = selection?.anchorNode;
    const el =
      anchor?.nodeType === Node.TEXT_NODE
        ? (anchor.parentElement as Element | null)
        : (anchor as Element | null);
    if (el?.closest(PDF_VIEW_SELECTOR)) {
      return selected;
    }
    // Selection may still be PDF text even if closest fails on some builds
    if (this.isPdfFile()) return selected;
    return '';
  }

  private tryAugmentMenu(menu: Menu, rawText?: string): void {
    if (this.augmentedMenus.has(menu)) return;
    if (!this.isPdfFile()) return;

    const text = (rawText ?? this.getPdfSelectionText()).trim();
    if (!text || !/[a-zA-Z]/.test(text)) return;

    const added = appendFleurDictMenuItems(
      menu,
      this.plugin,
      this.selectionHandler,
      text,
      { stripMarkdown: false }
    );
    if (added) {
      this.augmentedMenus.add(menu);
    }
  }

  /**
   * PDF++ fires workspace "pdf-menu" with the Menu instance before showing it.
   */
  private registerPdfPlusMenu(): void {
    this.plugin.registerEvent(
      // pdf-menu is provided by PDF++; not in core typings
      (this.plugin.app.workspace as any).on(
        'pdf-menu',
        (menu: Menu, data?: { selection?: string }) => {
          const text = data?.selection?.trim() || this.getPdfSelectionText();
          this.tryAugmentMenu(menu, text);
        }
      )
    );
  }

  /**
   * Native PDF (and any Menu shown while a PDF is active): append before show.
   * WeakSet prevents double-adding when PDF++ already triggered pdf-menu.
   */
  private patchMenuShowMethods(): void {
    const self = this;
    const proto = Menu.prototype as Menu & {
      showAtMouseEvent: MenuShowAtMouseEvent;
      showAtPosition: MenuShowAtPosition;
    };

    this.originalShowAtMouseEvent = proto.showAtMouseEvent;
    this.originalShowAtPosition = proto.showAtPosition;

    proto.showAtMouseEvent = function (this: Menu, evt: MouseEvent) {
      if (self.isPdfFile() && self.isInPdfView(evt.target)) {
        self.tryAugmentMenu(this);
      }
      return self.originalShowAtMouseEvent!.call(this, evt);
    };

    proto.showAtPosition = function (
      this: Menu,
      position: { x: number; y: number },
      doc?: Document
    ) {
      if (self.isPdfFile()) {
        self.tryAugmentMenu(this);
      }
      return self.originalShowAtPosition!.call(this, position, doc);
    };
  }

  private restoreMenuShowMethods(): void {
    const proto = Menu.prototype as Menu & {
      showAtMouseEvent: MenuShowAtMouseEvent;
      showAtPosition: MenuShowAtPosition;
    };
    if (this.originalShowAtMouseEvent) {
      proto.showAtMouseEvent = this.originalShowAtMouseEvent;
      this.originalShowAtMouseEvent = null;
    }
    if (this.originalShowAtPosition) {
      proto.showAtPosition = this.originalShowAtPosition;
      this.originalShowAtPosition = null;
    }
  }

  register(): void {
    this.registerPdfPlusMenu();
    this.patchMenuShowMethods();

    // Double-click lookup only — does not replace the context menu
    this.dblclickHandler = (evt: MouseEvent) => {
      if (!this.isPdfFile() || !this.isInPdfView(evt.target)) return;

      const word = getWordAtClickPoint(evt) || this.getPdfSelectionText();
      if (!word || !/[a-zA-Z]/.test(word)) return;

      // Do not preventDefault: allow normal double-click selection;
      // still open lookup for convenience.
      this.selectionHandler.lookupWord(word);
    };

    document.addEventListener('dblclick', this.dblclickHandler, true);
  }

  unregister(): void {
    if (this.dblclickHandler) {
      document.removeEventListener('dblclick', this.dblclickHandler, true);
      this.dblclickHandler = null;
    }
    this.restoreMenuShowMethods();
  }
}
