/**
 * Word Highlighter - 根据单词熟练度在编辑器中高亮显示
 * 使用 CodeMirror 6 Decoration API
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { RangeSetBuilder, StateField, StateEffect } from '@codemirror/state';
import type { Plugin } from 'obsidian';
import type { WordbookManager } from '../core/wordbook-manager';
import type { FleurDictSettings } from '../types';
import type { SelectionHandler } from './selection-handler';

// CSS classes for proficiency levels
const PROFICIENCY_CLASSES = [
  'fleurdict-highlight-red',    // proficiency 0: 陌生
  'fleurdict-highlight-yellow', // proficiency 1: 渐熟
  'fleurdict-highlight-green',  // proficiency 2: 熟悉
];

// Effect + StateField approach to reliably force decoration rebuild
const refreshEffect = StateEffect.define<number>();
const refreshField = StateField.define<number>({
  create() { return 0; },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(refreshEffect)) value += e.value;
    }
    return value;
  },
});

// Global registry of all active highlight plugin instances
const activeInstances = new Set<WordHighlightPlugin>();

interface WordHighlightPlugin {
  decorations: DecorationSet;
  forceRefresh(): void;
}

/**
 * Create CM6 ViewPlugin for word highlighting.
 * Returns [refreshField, ViewPlugin] — both must be registered as editor extensions.
 * Optional selectionHandler enables double-click-to-lookup in edit mode.
 */
export function createWordHighlightPlugin(
  plugin: Plugin,
  wordbookManager: WordbookManager,
  selectionHandler?: SelectionHandler
) {
  const settings = (plugin as any).settings as FleurDictSettings;

  /**
   * Check if highlighting is disabled globally (settings toggle).
   */
  const isHighlightDisabled = (): boolean => {
    if (!settings?.highlightEnabled) return true;
    return false;
  };

  /**
   * Extract the word at a CM6 document position.
   */
  function getWordAtPos(doc: { sliceString: (from: number, to: number) => string }, pos: number): string | null {
    // Get a generous window around the position
    const windowSize = 80;
    const start = Math.max(0, pos - windowSize);
    const end = Math.min(pos + windowSize, doc.length);
    const text = doc.sliceString(start, end);
    const localPos = pos - start;

    const wordRegex = /[a-zA-Z'-]+/g;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;
      if (localPos >= wordStart && localPos <= wordEnd) {
        return match[0];
      }
    }
    return null;
  }

  const highlightPlugin = ViewPlugin.fromClass(
    class implements WordHighlightPlugin {
      decorations: DecorationSet;
      private _dirty = true;
      private _refreshCount = 0;
      private dblclickHandler: ((e: MouseEvent) => void) | null = null;

      constructor(private view: EditorView) {
        this.decorations = Decoration.none;
        this._dirty = true;
        this._refreshCount = 0;
        activeInstances.add(this);

        // Register double-click handler for edit mode word lookup
        if (selectionHandler) {
          this.dblclickHandler = (e: MouseEvent) => {
            const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos === null) return;

            const word = getWordAtPos(this.view.state.doc, pos);
            if (!word) return;

            e.preventDefault();
            selectionHandler.lookupWord(word);
          };
          this.view.dom.addEventListener('dblclick', this.dblclickHandler, true);
        }
      }

      update(update: ViewUpdate) {
        const newCount = update.state.field(refreshField);
        if (this._dirty || update.docChanged || update.viewportChanged || newCount !== this._refreshCount) {
          this._dirty = false;
          this._refreshCount = newCount;
          this.decorations = this.buildDecorations();
        }
      }

      forceRefresh() {
        this._dirty = true;
        this.view.dispatch({
          effects: refreshEffect.of(1),
        });
      }

      destroy() {
        activeInstances.delete(this);
        if (this.dblclickHandler) {
          this.view.dom.removeEventListener('dblclick', this.dblclickHandler, true);
        }
      }

      buildDecorations(): DecorationSet {
        // Global toggle check
        if (isHighlightDisabled()) return Decoration.none;

        const allWords = wordbookManager.getAllEntries();

        // Filter words that need highlighting (proficiency 0, 1, 2)
        // Treat undefined proficiency as 0 (new words from old data)
        const wordsByLength = allWords
          .filter(w => (w.proficiency ?? 0) < 3)
          .map(w => ({
            word: w.word,
            cls: PROFICIENCY_CLASSES[w.proficiency ?? 0] || PROFICIENCY_CLASSES[0],
          }))
          .sort((a, b) => b.word.length - a.word.length); // longer words first to avoid overlap

        if (wordsByLength.length === 0) {
          return Decoration.none;
        }

        // CRITICAL: RangeSetBuilder requires decorations to be added in sorted order
        // We must collect all decorations first, sort them, then add to builder
        interface DecorationItem {
          from: number;
          to: number;
          cls: string;
        }
        const items: DecorationItem[] = [];
        const highlighted = new Set<number>();

        // Iterate over visible ranges - these are already sorted by CM6
        for (const range of this.view.visibleRanges) {
          const text = this.view.state.doc.sliceString(range.from, range.to);
          const lines = text.split('\n');
          let offset = range.from;

          for (const lineText of lines) {
            // Collect matches for this line
            for (const { word, cls } of wordsByLength) {
              const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
              let match;

              while ((match = regex.exec(lineText)) !== null) {
                const start = offset + match.index;
                const end = start + match[0].length;

                // Skip if any character in this range is already highlighted
                let overlap = false;
                for (let i = start; i < end; i++) {
                  if (highlighted.has(i)) {
                    overlap = true;
                    break;
                  }
                }
                if (overlap) continue;

                // Mark positions as highlighted
                for (let i = start; i < end; i++) highlighted.add(i);

                items.push({ from: start, to: end, cls });
              }
            }

            offset += lineText.length + 1; // +1 for newline
          }
        }

        if (items.length === 0) {
          return Decoration.none;
        }

        // CRITICAL: Sort by 'from' position, then by 'to' position for same 'from'
        // This is required by CodeMirror's RangeSetBuilder
        items.sort((a, b) => {
          if (a.from !== b.from) return a.from - b.from;
          return a.to - b.to;
        });

        // Build the DecorationSet
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to, cls } of items) {
          builder.add(from, to, Decoration.mark({ class: cls }));
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  // Must register both: the StateField (to hold the counter) AND the ViewPlugin
  return [refreshField, highlightPlugin];
}

/**
 * Refresh all editor views to re-render highlights
 * Call this after wordbook changes (add word, review, etc.)
 */
export function refreshAllEditorHighlights(_plugin?: Plugin) {
  activeInstances.forEach(instance => {
    instance.forceRefresh();
  });
}
