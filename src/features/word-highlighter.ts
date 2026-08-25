/**
 * Word Highlighter - 根据单词熟练度在编辑器中高亮显示
 * 使用 CodeMirror 6 Decoration API
 */

import { ViewPlugin, ViewUpdate, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { Plugin, MarkdownView } from 'obsidian';
import type { WordbookManager } from '../core/wordbook-manager';

// CSS classes for proficiency levels
const PROFICIENCY_CLASSES = [
  'fleurdict-highlight-red',    // proficiency 0: 陌生
  'fleurdict-highlight-yellow', // proficiency 1: 渐熟
  'fleurdict-highlight-green',  // proficiency 2: 熟悉
];

/**
 * Create CM6 ViewPlugin for word highlighting
 */
export function createWordHighlightPlugin(plugin: Plugin, wordbookManager: WordbookManager) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(private view: EditorView) {
        this.decorations = this.buildDecorations();
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations();
        }
      }

      buildDecorations(): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const allWords = wordbookManager.getAllEntries();

        // Filter words that need highlighting (proficiency 0, 1, 2)
        const wordsByLength = allWords
          .filter(w => w.proficiency !== undefined && w.proficiency < 3)
          .map(w => ({
            word: w.word,
            cls: PROFICIENCY_CLASSES[w.proficiency] || PROFICIENCY_CLASSES[0],
          }))
          .sort((a, b) => b.word.length - a.word.length); // longer words first to avoid overlap

        if (wordsByLength.length === 0) {
          return Decoration.none;
        }

        // Iterate over visible ranges for performance
        for (const { from, to } of this.view.visibleRanges) {
          const text = this.view.state.doc.sliceString(from, to);
          const lines = text.split('\n');
          let offset = from;

          for (const lineText of lines) {
            // Track which character positions are already highlighted to avoid overlap
            const highlighted = new Set<number>();

            for (const { word, cls } of wordsByLength) {
              // Escape regex special characters
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

                builder.add(start, end, Decoration.mark({ class: cls }));
              }
            }

            offset += lineText.length + 1; // +1 for newline
          }
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

/**
 * Refresh all editor views to re-render highlights
 * Call this after wordbook changes (add word, review, etc.)
 */
export function refreshAllEditorHighlights(plugin: Plugin) {
  plugin.app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view;
    if (view.getViewType() === 'markdown') {
      const markdownView = view as MarkdownView;
      const cm = (markdownView.editor as any)?.cm;
      if (cm) {
        // Dispatch empty transaction to trigger ViewPlugin update
        cm.dispatch({});
      }
    }
  });
}
