/**
 * FleurDict - Flashcard Review Modal
 * SM-2 spaced repetition flashcard review interface
 */

import { App, Modal, Setting, ButtonComponent } from 'obsidian';
import { WordEntry, FlashcardSession, FlashcardRating, FleurDictSettings } from '../types';
import { FlashcardEngine } from '../core/flashcard-engine';

/**
 * Flashcard review modal
 */
export class FlashcardModal extends Modal {
  private settings: FleurDictSettings;
  private engine: FlashcardEngine;
  private session: FlashcardSession;
  private currentCard: WordEntry | null = null;
  private isFlipped = false;
  private onUpdate: () => void;
  private audio: HTMLAudioElement | null = null;

  constructor(
    app: App,
    settings: FleurDictSettings,
    engine: FlashcardEngine,
    session: FlashcardSession,
    onUpdate: () => void
  ) {
    super(app);
    this.settings = settings;
    this.engine = engine;
    this.session = session;
    this.onUpdate = onUpdate;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fleurdict-flashcard-modal');

    this.renderCard();
  }

  onClose() {
    const { contentEl } = this;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    contentEl.empty();
  }

  /**
   * Play audio for current card based on audioPreference setting
   */
  private playCardAudio() {
    if (!this.currentCard) return;

    // Stop previous audio
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    // Pick audio URL based on preference
    const pref = this.settings.audioPreference || 'uk';
    const audioUrl = pref === 'us'
      ? (this.currentCard.audioUrlUS || this.currentCard.audioUrlUK)
      : (this.currentCard.audioUrlUK || this.currentCard.audioUrlUS);

    if (!audioUrl) {
      // Fallback: generate from Youdao dictvoice
      const fallbackUrl = pref === 'us'
        ? `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(this.currentCard.word)}&type=2`
        : `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(this.currentCard.word)}&type=1`;
      this.audio = new Audio(fallbackUrl);
      this.audio.play().catch(e => console.warn('FleurDict: Audio play failed:', e));
      return;
    }

    this.audio = new Audio(audioUrl);
    this.audio.play().catch(e => console.warn('FleurDict: Audio play failed:', e));
  }

  /**
   * Render the current flashcard
   */
  private renderCard() {
    const { contentEl } = this;
    contentEl.empty();

    // Get current card
    this.currentCard = this.engine.getCurrentCard();

    if (!this.currentCard) {
      this.renderSessionComplete();
      return;
    }

    // Header with progress
    const headerEl = contentEl.createEl('div', { cls: 'fleurdict-flashcard-header' });
    const progress = this.session.currentIndex + 1;
    const total = this.session.cards.length;
    headerEl.createEl('span', {
      text: `${progress} / ${total}`,
      cls: 'fleurdict-flashcard-progress',
    });

    const modeText = this.session.mode === 'due' ? '到期复习' :
                     this.session.mode === 'category' ? '分类复习' :
                     this.session.mode === 'random' ? '随机复习' : '全部复习';
    headerEl.createEl('span', {
      text: modeText,
      cls: 'fleurdict-flashcard-mode',
    });

    // Card container
    const cardContainer = contentEl.createEl('div', { cls: 'fleurdict-flashcard-container' });

    // Card front (word)
    const frontEl = cardContainer.createEl('div', {
      cls: `fleurdict-flashcard-face fleurdict-flashcard-front ${this.isFlipped ? 'flipped' : ''}`,
    });

    if (!this.isFlipped) {
      // Show word
      frontEl.createEl('div', {
        text: this.currentCard.word,
        cls: 'fleurdict-flashcard-word',
      });

      // Audio row: play button + phonetic text
      const audioRowEl = frontEl.createEl('div', { cls: 'fleurdict-flashcard-audio-row' });

      if (this.currentCard.phonetic) {
        audioRowEl.createEl('span', {
          text: this.currentCard.phonetic,
          cls: 'fleurdict-flashcard-phonetic',
        });
      }

      // Play audio button (always show on front)
      const playBtn = audioRowEl.createEl('button', { cls: 'fleurdict-flashcard-play-btn' });
      playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
      const accent = this.settings.audioPreference === 'us' ? '美' : '英';
      playBtn.title = `播放${accent}式发音`;
      playBtn.addEventListener('click', () => {
        this.playCardAudio();
      });

      if (this.currentCard.context) {
        frontEl.createEl('div', {
          text: this.currentCard.context,
          cls: 'fleurdict-flashcard-context',
        });
      }

      // Flip button
      const flipBtn = frontEl.createEl('button', {
        text: '点击显示释义',
        cls: 'fleurdict-flashcard-flip-btn',
      });
      flipBtn.addEventListener('click', () => {
        this.isFlipped = true;
        this.renderCard();
      });

      // Auto-play audio on card show if setting enabled
      if (this.settings.autoPlayAudio) {
        // Small delay to let the DOM render first
        setTimeout(() => this.playCardAudio(), 300);
      }
    } else {
      // Show meaning
      frontEl.createEl('div', {
        text: this.currentCard.word,
        cls: 'fleurdict-flashcard-word',
      });

      frontEl.createEl('div', {
        text: this.currentCard.meaning || '暂无释义',
        cls: 'fleurdict-flashcard-meaning',
      });

      if (this.currentCard.note) {
        frontEl.createEl('div', {
          text: this.currentCard.note,
          cls: 'fleurdict-flashcard-note',
        });
      }

      // Rating buttons
      const ratingEl = cardContainer.createEl('div', { cls: 'fleurdict-flashcard-rating' });
      ratingEl.createEl('div', {
        text: '你记得这个单词吗？',
        cls: 'fleurdict-flashcard-rating-prompt',
      });

      const buttonsEl = ratingEl.createEl('div', { cls: 'fleurdict-flashcard-rating-buttons' });

      // Rating buttons: Again, Hard, Good, Easy
      const ratings: { label: string; rating: FlashcardRating; cls: string }[] = [
        { label: '忘了', rating: 1, cls: 'fleurdict-rating-again' },
        { label: '困难', rating: 3, cls: 'fleurdict-rating-hard' },
        { label: '良好', rating: 4, cls: 'fleurdict-rating-good' },
        { label: '简单', rating: 5, cls: 'fleurdict-rating-easy' },
      ];

      for (const r of ratings) {
        const btn = buttonsEl.createEl('button', {
          text: r.label,
          cls: `fleurdict-flashcard-rating-btn ${r.cls}`,
        });
        btn.addEventListener('click', () => {
          this.handleRating(r.rating);
        });
      }
    }

    // Footer with controls
    const footerEl = contentEl.createEl('div', { cls: 'fleurdict-flashcard-footer' });

    // Skip button
    const skipBtn = footerEl.createEl('button', {
      text: '跳过',
      cls: 'fleurdict-flashcard-skip-btn',
    });
    skipBtn.addEventListener('click', () => {
      this.engine.nextCard();
      this.isFlipped = false;
      this.renderCard();
    });

    // Stats
    const statsEl = footerEl.createEl('div', { cls: 'fleurdict-flashcard-stats' });
    const reviewed = this.session.reviewedCount;
    const elapsed = Math.floor((Date.now() - this.session.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    statsEl.setText(`已复习: ${reviewed} | 用时: ${minutes}:${seconds.toString().padStart(2, '0')}`);
  }

  /**
   * Handle rating submission
   */
  private handleRating(rating: FlashcardRating) {
    if (!this.currentCard) return;

    // Apply SM-2 algorithm
    this.engine.rateCard(rating);

    // Move to next card
    this.engine.nextCard();
    this.isFlipped = false;

    // Notify update
    this.onUpdate();

    // Render next card
    this.renderCard();
  }

  /**
   * Render session complete screen
   */
  private renderSessionComplete() {
    const { contentEl } = this;

    const completeEl = contentEl.createEl('div', { cls: 'fleurdict-flashcard-complete' });

    completeEl.createEl('div', {
      text: '✓',
      cls: 'fleurdict-flashcard-complete-emoji',
    });

    completeEl.createEl('div', {
      text: '复习完成！',
      cls: 'fleurdict-flashcard-complete-title',
    });

    // Stats
    const statsEl = completeEl.createEl('div', { cls: 'fleurdict-flashcard-complete-stats' });

    const reviewed = this.session.reviewedCount;
    const elapsed = Math.floor((Date.now() - this.session.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    statsEl.createEl('div', {
      text: `复习单词: ${reviewed} 个`,
      cls: 'fleurdict-flashcard-stat',
    });

    statsEl.createEl('div', {
      text: `用时: ${minutes} 分 ${seconds} 秒`,
      cls: 'fleurdict-flashcard-stat',
    });

    // Close button
    const closeBtn = completeEl.createEl('button', {
      text: '完成',
      cls: 'fleurdict-flashcard-complete-btn',
    });
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }
}
