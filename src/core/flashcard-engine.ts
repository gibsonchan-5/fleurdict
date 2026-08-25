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
   * Rate the current card and update its proficiency level
   */
  rateCard(rating: FlashcardRating): void {
    const card = this.getCurrentCard();
    if (!card) return;

    // Update review timestamp and count
    card.lastReviewed = now();
    card.reviewCount++;

    // Apply proficiency-based algorithm
    if (rating === 1) {
      // 陌生 (forgot): Reset proficiency to 0, reset consecutive correct
      card.proficiency = 0;
      card.consecutiveCorrect = 0;
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
    } else if (rating === 2) {
      // 渐熟 (learning): Increment consecutive correct
      card.consecutiveCorrect++;
      
      // Check if ready to upgrade to proficiency 1
      if (card.consecutiveCorrect >= 2) {
        card.proficiency = 1;
        card.consecutiveCorrect = 0;
        card.easeFactor = Math.min(3.0, card.easeFactor + 0.1);
      } else {
        // Stay at proficiency 0, slight ease factor increase
        card.easeFactor = Math.min(3.0, card.easeFactor + 0.05);
      }
    } else if (rating === 3) {
      // 熟悉 (known): Increment consecutive correct
      card.consecutiveCorrect++;
      
      // Check if ready to upgrade to proficiency 2
      if (card.proficiency === 0 && card.consecutiveCorrect >= 2) {
        card.proficiency = 2;
        card.consecutiveCorrect = 0;
        card.easeFactor = Math.min(3.0, card.easeFactor + 0.2);
      } else if (card.proficiency === 1 && card.consecutiveCorrect >= 3) {
        card.proficiency = 2;
        card.consecutiveCorrect = 0;
        card.easeFactor = Math.min(3.0, card.easeFactor + 0.15);
      } else {
        // Stay at current proficiency, moderate ease factor increase
        card.easeFactor = Math.min(3.0, card.easeFactor + 0.1);
      }
    }

    // Calculate interval based on proficiency level
    if (card.proficiency === 0) {
      card.interval = 1; // 1 day
    } else if (card.proficiency === 1) {
      card.interval = 3; // 3 days
    } else if (card.proficiency === 2) {
      card.interval = 7; // 7 days
    }

    // Calculate next review time
    card.nextReview = now() + card.interval * 24 * 60 * 60 * 1000;
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
