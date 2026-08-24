/**
 * FleurDict - Flashcard Engine
 * Implements SM-2 spaced repetition algorithm
 */

import { WordEntry, FlashcardSession, FlashcardMode, FlashcardRating } from '../types';
import { now } from '../utils/helpers';

/**
 * Flashcard engine - manages review sessions
 */
export class FlashcardEngine {
  private session: FlashcardSession | null = null;

  /**
   * Start a new review session
   */
  startSession(
    mode: FlashcardMode,
    entries: WordEntry[],
    categoryId?: string,
    dailyLimit?: number
  ): FlashcardSession {
    let cards = [...entries];

    // Filter based on mode
    if (mode === 'due') {
      const nowTimestamp = now();
      cards = cards.filter((e) => e.nextReview <= nowTimestamp);
    }

    // Apply daily limit
    if (dailyLimit && cards.length > dailyLimit) {
      cards = cards.slice(0, dailyLimit);
    }

    // Shuffle for random mode
    if (mode === 'random') {
      cards = this.shuffle(cards);
    }

    this.session = {
      mode,
      categoryId,
      cards,
      currentIndex: 0,
      reviewedCount: 0,
      startTime: now(),
    };

    return this.session;
  }

  /**
   * Get current card
   */
  getCurrentCard(): WordEntry | null {
    if (!this.session || this.isSessionComplete()) {
      return null;
    }
    return this.session.cards[this.session.currentIndex];
  }

  /**
   * Move to next card
   */
  nextCard(): WordEntry | null {
    if (!this.session || this.isSessionComplete()) {
      return null;
    }

    this.session.currentIndex++;
    this.session.reviewedCount++;

    if (this.isSessionComplete()) {
      return null;
    }

    return this.session.cards[this.session.currentIndex];
  }

  /**
   * Check if session is complete
   */
  isSessionComplete(): boolean {
    if (!this.session) return true;
    return this.session.currentIndex >= this.session.cards.length;
  }

  /**
   * Get session progress
   */
  getProgress(): { current: number; total: number; reviewed: number } {
    if (!this.session) {
      return { current: 0, total: 0, reviewed: 0 };
    }

    return {
      current: this.session.currentIndex + 1,
      total: this.session.cards.length,
      reviewed: this.session.reviewedCount,
    };
  }

  /**
   * Get current session
   */
  getSession(): FlashcardSession | null {
    return this.session;
  }

  /**
   * End current session
   */
  endSession(): void {
    this.session = null;
  }

  /**
   * Calculate SM-2 schedule for next review
   */
  static calculateSchedule(entry: WordEntry, rating: FlashcardRating): {
    interval: number;
    easeFactor: number;
    nextReview: number;
  } {
    let interval = entry.interval;
    let easeFactor = entry.easeFactor;

    if (rating < 3) {
      // Failed - reset
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    } else {
      // Passed
      if (interval === 0) {
        interval = 1;
      } else if (interval === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }

      if (rating === 5) {
        easeFactor += 0.1;
      } else if (rating === 3) {
        easeFactor = Math.max(1.3, easeFactor - 0.1);
      }
    }

    const nextReview = now() + interval * 24 * 60 * 60 * 1000;

    return { interval, easeFactor, nextReview };
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
