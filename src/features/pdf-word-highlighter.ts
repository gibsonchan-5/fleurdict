/**
 * FleurDict - PDF Word Highlighter (overlay architecture, v9)
 *
 * WHY THIS FILE DOES NOT TOUCH THE TEXT LAYER'S TEXT NODES ANY MORE
 * ----------------------------------------------------------------
 * Obsidian's PDF viewer paints the visible glyphs on a <canvas>; the
 * `.textLayer` above it only carries invisible (color:transparent) text used
 * for selection. Obsidian deliberately dims that layer:
 *
 *     .pdf-container .textLayer { opacity: 0.2; }
 *
 * so that selection / highlight backgrounds never hide the canvas glyphs.
 *
 * Two consequences we learned the hard way (see work log v1-v8):
 *  1. Forcing `.textLayer { opacity: 1 }` makes EVERY background painted
 *     inside the layer opaque — a double-clicked word turns into a solid
 *     accent-coloured block that covers the text.
 *  2. `.textLayer span { position: absolute }` — any <span> we inject there
 *     is ripped out of the text flow, so highlights land in the wrong place.
 *
 * This version therefore never mutates the text layer. It paints translucent
 * rectangles in a dedicated overlay element appended next to the page, using
 * Range.getClientRects() for geometry. Benefits:
 *  - zero risk of duplicating / reflowing PDF text (selection text stays exact);
 *  - full colour control (alpha of our choosing), independent of the 0.2 dim;
 *  - cross-span and hyphenated words are handled for free (a Range spans nodes).
 *
 * Persistence: one body-level MutationObserver (fleur-pdf bodyWatcher pattern)
 * plus a 1.5s self-heal pass; a key (wordbook signature + layer geometry +
 * overlay presence) keeps both cheap no-ops while nothing changed.
 */

import { Notice } from 'obsidian';
import { FleurDictSettings } from '../types';
import type { WordbookManager } from '../core/wordbook-manager';
import { debugLog } from '../core/debug';

const OVERLAY_CLASS = 'fleurdict-pdf-hl-layer';
const BOX_CLASS = 'fleurdict-pdf-hl-box';
/** Class used by the retired in-layer wrapping version — only for cleanup. */
const LEGACY_WRAP_CLASS = 'fleurdict-pdf-hl';

// PDF-specific translucent palette, deliberately separate from the Markdown
// highlight scheme (Markdown keeps its own red/yellow/green classes).
// The overlay sits outside the dimmed text layer, so the alpha below is what
// the eye actually sees on the white page: a highlighter wash, not a block.
const PROFICIENCY_COLORS = [
  'rgba(228, 74, 66, 0.30)',   // proficiency 0: 陌生
  'rgba(240, 176, 32, 0.34)',  // proficiency 1: 渐熟
  'rgba(72, 190, 128, 0.28)',  // proficiency 2: 熟悉
];

interface WordMatcher {
  regex: RegExp;
  proficiencyOf: (word: string) => number;
  signature: string;
}

interface NodeRange {
  node: Text;
  start: number; // offset in merged text (inclusive)
  end: number;   // offset in merged text (exclusive)
}

interface MatchSegment {
  start: number; // merged-text offset (inclusive)
  end: number;   // merged-text offset (exclusive)
  color: string; // rgba fill for the overlay box
}

export class PdfWordHighlighter {
  private plugin: any;
  private settings: FleurDictSettings;
  private wordbookManager: WordbookManager;
  // Body-level observer (fleur-pdf pattern): catches pdf containers appearing,
  // pages rendering, async text population, scroll re-renders — everything,
  // with zero assumptions about Obsidian's container class names.
  private bodyObserver: MutationObserver | null = null;
  private applyTimer: number | null = null;
  // Cheap change detector: wordbook signature + layer geometry + overlay state
  private lastKey = '';
  private legacyChecked = false;
  private lastDiagLog = 0;

  constructor(plugin: any, settings: FleurDictSettings, wordbookManager: WordbookManager) {
    this.plugin = plugin;
    this.settings = settings;
    this.wordbookManager = wordbookManager;
  }

  register(): void {
    this.plugin.app.workspace.onLayoutReady(() => {
      this.scheduleApply();
      this.startBodyWatcher();
    });

    // Wordbook changed (add / delete / proficiency update, persisted via save())
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('fleurdict:wordbook-changed', () => {
        window.setTimeout(() => this.scheduleApply(), 300);
      })
    );

    // Self-heal: covers any missed mutation (pdf.js render races, late font
    // load, observer attach gaps). The key gate makes it a no-op when in sync.
    this.plugin.registerInterval(window.setInterval(() => this.apply(), 1500));
  }

  private startBodyWatcher(): void {
    if (this.bodyObserver) return;
    this.bodyObserver = new MutationObserver((mutations) => {
      // Ignore our own overlay writes, otherwise we would loop forever.
      if (!mutations.some((m) => this.isForeignMutation(m))) return;
      this.scheduleApply();
    });
    this.bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  /** True when a mutation did NOT come from our own overlay painting. */
  private isForeignMutation(m: MutationRecord): boolean {
    const target = m.target as HTMLElement;
    if (this.ownsElement(target)) return false;
    const nodes = [...Array.from(m.addedNodes), ...Array.from(m.removedNodes)];
    if (nodes.length > 0) {
      const allOurs = nodes.every((n) => this.ownsElement(n as HTMLElement));
      if (allOurs) return false;
    }
    return true;
  }

  private ownsElement(el: Node | null): boolean {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const el2 = el as HTMLElement;
    return (
      el2.classList?.contains(OVERLAY_CLASS) === true ||
      el2.closest?.(`.${OVERLAY_CLASS}`) !== null
    );
  }

  unregister(): void {
    if (this.applyTimer !== null) {
      window.clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
    this.bodyObserver?.disconnect();
    this.bodyObserver = null;
    this.clearAll();
  }

  updateSettings(settings: FleurDictSettings): void {
    this.settings = settings;
    if (!settings.pdfHighlightEnabled) {
      this.clearAll();
    } else {
      this.scheduleApply();
    }
  }

  /** Debounced apply — coalesces bursts of mutations (page render, scrolling). */
  scheduleApply(): void {
    if (this.applyTimer !== null) {
      window.clearTimeout(this.applyTimer);
    }
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = null;
      this.apply();
    }, 150);
  }

  /**
   * Repaint every rendered text layer. `.textLayer` is a pdf.js-specific class,
   * so a global query is safe and avoids depending on Obsidian's containers.
   */
  private apply(): void {
    if (!this.settings.pdfHighlightEnabled) return;

    if (!this.legacyChecked) {
      this.repairLegacyWraps();
      this.legacyChecked = true;
    }

    const matcher = this.buildWordMatcher();
    const textLayers = Array.from(document.querySelectorAll<HTMLElement>('.textLayer'));
    const key = this.computeKey(matcher, textLayers);
    if (key === this.lastKey) return;
    this.lastKey = key;

    // Group by host so several layers sharing a page reuse one overlay
    const byHost = new Map<HTMLElement, HTMLElement[]>();
    for (const layer of textLayers) {
      const host = layer.parentElement;
      if (!host) continue;
      const list = byHost.get(host) || [];
      list.push(layer);
      byHost.set(host, list);
    }

    byHost.forEach((layers, host) => {
      try {
        this.paintHost(host, layers, matcher);
      } catch (error) {
        // Never let one bad page kill the rest — log loudly instead
        console.error('[FleurDict-PDF] paintHost failed:', error);
      }
    });

    if (textLayers.length > 0) {
      const now = Date.now();
      if (now - this.lastDiagLog > 10000) {
        this.lastDiagLog = now;
        debugLog(
          `[FleurDict-PDF] apply: layers=${textLayers.length} ` +
          `boxes=${document.querySelectorAll(`.${BOX_CLASS}`).length} ` +
          `textLayerOpacity=${getComputedStyle(textLayers[0]).opacity}`
        );
      }
    }
  }

  /** Wordbook signature + layer geometry + overlay presence. */
  private computeKey(matcher: WordMatcher | null, layers: HTMLElement[]): string {
    const sig = matcher ? matcher.signature : '∅';
    const geo = layers
      .map((layer) => {
        const host = layer.parentElement;
        const hasOverlay = host
          ? host.querySelector(`:scope > .${OVERLAY_CLASS}`) !== null
          : false;
        return `${(layer.textContent || '').length}:${hasOverlay ? 1 : 0}`;
      })
      .join(',');
    return `${sig}|${layers.length}|${geo}`;
  }

  /**
   * Build a word list (longest first so multi-word entries win) plus a
   * proficiency lookup and a signature of the current wordbook state.
   */
  private buildWordMatcher(): WordMatcher | null {
    const entries = this.wordbookManager.getAllEntries();

    // Same rule as the Markdown highlighter: proficiency >= 3 is not highlighted,
    // undefined proficiency counts as 0 (new / foreign words)
    const candidates = entries
      .filter((w) => w.word && /[a-zA-Z]/.test(w.word) && (w.proficiency ?? 0) < 3)
      .map((w) => ({ word: String(w.word).trim(), proficiency: w.proficiency ?? 0 }))
      .filter((c) => c.word.length > 0)
      .sort((a, b) => b.word.length - a.word.length);

    const signature = candidates
      .map((c) => `${c.word.toLowerCase()}:${c.proficiency}`)
      .sort()
      .join('|');

    if (candidates.length === 0) return null;

    const escaped = candidates.map((c) => c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
    const proficiencyMap = new Map(candidates.map((c) => [c.word.toLowerCase(), c.proficiency]));

    return {
      regex,
      proficiencyOf: (word: string) => proficiencyMap.get(word.toLowerCase()) ?? 0,
      signature,
    };
  }

  /**
   * Paint one PDF page: ensure the overlay element, then draw one translucent
   * box per matched word fragment.
   */
  private paintHost(host: HTMLElement, layers: HTMLElement[], matcher: WordMatcher | null): void {
    let overlay = host.querySelector<HTMLElement>(`:scope > .${OVERLAY_CLASS}`);

    if (!matcher) {
      overlay?.remove();
      return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.addClass(OVERLAY_CLASS);
      // Last child → paints above the canvas and the (transparent) text layer
      host.appendChild(overlay);
    }

    overlay.empty();

    // The overlay is absolutely positioned at the containing block's origin
    // (left:0 / top:0), so its own rect is a stable coordinate origin for the
    // boxes — this works no matter which ancestor ends up being the containing
    // block, and it stays correct while the page scrolls.
    const origin = overlay.getBoundingClientRect();

    for (const layer of layers) {
      const nodes = this.collectTextNodes(layer);
      if (nodes.length === 0) continue;

      const ranges: NodeRange[] = [];
      let merged = '';
      for (const node of nodes) {
        const text = node.nodeValue || '';
        ranges.push({ node, start: merged.length, end: merged.length + text.length });
        merged += text + '\n'; // '\n' separator is owned by no node
      }

      const segments = this.findSegments(merged, matcher);
      for (const segment of segments) {
        const rects = this.rectsForSegment(ranges, segment);
        for (const rect of rects) {
          if (rect.width < 1 || rect.height < 1) continue;
          const box = document.createElement('div');
          box.addClass(BOX_CLASS);
          box.style.left = `${rect.left - origin.left}px`;
          box.style.top = `${rect.top - origin.top}px`;
          box.style.width = `${rect.width}px`;
          box.style.height = `${rect.height}px`;
          box.style.backgroundColor = segment.color;
          overlay.appendChild(box);
        }
      }
    }
  }

  /**
   * Collect text nodes inside one textLayer via TreeWalker — immune to any
   * span nesting pdf.js uses (chunk spans, markedContent wrappers, …).
   */
  private collectTextNodes(layer: HTMLElement): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!(node.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
        // Ignore anything inside a leftover wrapper from the old version
        const parent = (node as Text).parentElement;
        if (parent && parent.closest(`.${LEGACY_WRAP_CLASS}`)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    return nodes;
  }

  /**
   * Find matches on the merged layer text.
   * Pass 1: direct matches.
   * Pass 2: matches on dehyphenated text so words broken across lines
   *         ("com-" + "\n" + "panion") are caught too.
   */
  private findSegments(merged: string, matcher: WordMatcher): MatchSegment[] {
    const segments: MatchSegment[] = [];
    const occupied = new Set<number>();

    const colorOf = (word: string) =>
      PROFICIENCY_COLORS[matcher.proficiencyOf(word)] || PROFICIENCY_COLORS[0];

    // ---- Pass 1: direct matches ----
    matcher.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = matcher.regex.exec(merged)) !== null) {
      // Skip matches spanning the virtual separator
      if (merged.slice(m.index, m.index + m[0].length).includes('\n')) continue;
      segments.push({ start: m.index, end: m.index + m[0].length, color: colorOf(m[0]) });
      for (let p = m.index; p < m.index + m[0].length; p++) occupied.add(p);
      if (m[0].length === 0) matcher.regex.lastIndex++; // guard against zero-length
    }

    // ---- Pass 2: hyphenated cross-node matches ----
    let dehyph = '';
    const map: number[] = []; // dehyph position -> merged position
    for (let i = 0; i < merged.length; i++) {
      const ch = merged[i];
      if (ch === '-' && merged[i + 1] === '\n') {
        i++; // drop the hyphen + newline from matching
        continue;
      }
      map.push(i);
      dehyph += ch;
    }

    if (dehyph.length !== merged.length) {
      matcher.regex.lastIndex = 0;
      while ((m = matcher.regex.exec(dehyph)) !== null) {
        let overlap = false;
        for (let p = m.index; p < m.index + m[0].length; p++) {
          if (occupied.has(map[p])) overlap = true;
        }
        if (!overlap) {
          const rawStart = map[m.index];
          const rawEnd = map[m.index + m[0].length - 1] + 1;
          segments.push({ start: rawStart, end: rawEnd, color: colorOf(m[0]) });
          for (let p = m.index; p < m.index + m[0].length; p++) occupied.add(map[p]);
        }
        if (m[0].length === 0) matcher.regex.lastIndex++;
      }
    }

    return segments;
  }

  /** Map merged offsets to a DOM Range and return its client rects. */
  private rectsForSegment(ranges: NodeRange[], segment: MatchSegment): DOMRect[] {
    const start = this.locate(ranges, segment.start);
    const end = this.locate(ranges, segment.end);
    if (!start || !end) return [];

    try {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const rects: DOMRect[] = [];
      const list = range.getClientRects();
      for (let i = 0; i < list.length; i++) rects.push(list[i]);
      range.detach?.();
      return rects;
    } catch {
      return [];
    }
  }

  /**
   * Resolve a merged-text offset to a (text node, offset) pair.
   * Offsets landing on the virtual '\n' separators clamp to the neighbouring
   * node so hyphenated matches still resolve.
   */
  private locate(ranges: NodeRange[], pos: number): { node: Text; offset: number } | null {
    for (const range of ranges) {
      if (pos >= range.start && pos <= range.end) {
        return { node: range.node, offset: pos - range.start };
      }
    }
    const last = ranges[ranges.length - 1];
    if (last && pos > last.end) {
      return { node: last.node, offset: (last.node.nodeValue || '').length };
    }
    return null;
  }

  /**
   * Remove highlight wrappers left in the DOM by the retired (v8) version.
   * That version inserted a span holding a COPY of the matched text right
   * before the original text node — which duplicated the page text, doubled
   * the selection and broke dictionary lookups. Dropping the span restores
   * the exact original DOM (the original text node is still in place).
   */
  private repairLegacyWraps(): void {
    const legacy = document.querySelectorAll<HTMLElement>(`.${LEGACY_WRAP_CLASS}`);
    legacy.forEach((span) => {
      const text = span.textContent || '';
      const next = span.nextSibling;
      const isDuplicate =
        next !== null &&
        next.nodeType === Node.TEXT_NODE &&
        (next.nodeValue || '').startsWith(text);
      if (isDuplicate) {
        span.remove(); // the real text node follows — just drop the copy
      } else {
        span.replaceWith(document.createTextNode(text));
      }
    });
  }

  /** Remove overlays (and legacy wrappers) — settings off / plugin unload. */
  private clearAll(): void {
    document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
    this.repairLegacyWraps();
    this.lastKey = '';
  }

  /**
   * fleur-pdf-style diagnostic: surfaces DOM ground truth via Notice,
   * no dev console needed.
   */
  diagnose(): void {
    const layers = Array.from(document.querySelectorAll<HTMLElement>('.textLayer'));
    const withText = layers.filter((tl) => (tl.textContent || '').trim().length > 0);
    const entries = this.wordbookManager.getAllEntries();
    const boxes = document.querySelectorAll(`.${BOX_CLASS}`).length;
    const overlays = document.querySelectorAll(`.${OVERLAY_CLASS}`).length;
    const legacy = document.querySelectorAll(`.${LEGACY_WRAP_CLASS}`).length;
    const target = withText[0] ?? layers[0];

    let firstInfo = '（页面上没有 textLayer）';
    if (target) {
      const spans = target.querySelectorAll('span');
      const op = getComputedStyle(target).opacity;
      const len = (target.textContent || '').trim().length;
      firstInfo = `spans=${spans.length}, opacity=${op}, textLen=${len}`;
    }

    const msg = [
      `开关 pdfHighlightEnabled = ${this.settings.pdfHighlightEnabled}`,
      `词表 ${entries.length} 条：${entries.slice(0, 5).map((w) => w.word).join('、') || '（空）'}`,
      `textLayer 共 ${layers.length} 个（含文本 ${withText.length} 个）`,
      `首个 → ${firstInfo}`,
      `overlay 图层 ${overlays} 个，已画高亮方框 ${boxes} 个`,
      `旧版残留包裹 span = ${legacy} 个`,
    ].join('\n');
    debugLog('[FleurDict-PDF] 诊断报告\n' + msg);
    new Notice(msg, 12000);
  }
}
