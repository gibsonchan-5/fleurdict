/**
 * FleurDict - Edit Entry Modal
 * Modal dialog for editing a word entry (meaning, phonetic, note)
 */

import { App, Modal, Setting } from 'obsidian';
import { WordEntry } from '../types';
import { WordbookManager } from '../core/wordbook-manager';

export class EditEntryModal extends Modal {
  private entry: WordEntry;
  private wordbookManager: WordbookManager;
  private onSave: (updated: WordEntry) => void;

  private meaningInput: HTMLTextAreaElement;
  private phoneticInput: HTMLInputElement;
  private noteInput: HTMLTextAreaElement;

  constructor(
    app: App,
    entry: WordEntry,
    wordbookManager: WordbookManager,
    onSave: (updated: WordEntry) => void
  ) {
    super(app);
    this.entry = { ...entry }; // Clone to avoid mutating the original
    this.wordbookManager = wordbookManager;
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('fleurdict-edit-modal');

    new Setting(contentEl)
      .setHeading()
      .setName(`编辑: ${this.entry.word}`);

    // Phonetic
    new Setting(contentEl)
      .setName('音标')
      .addText((text) => {
        text.setValue(this.entry.phonetic).onChange((v) => {
          this.entry.phonetic = v;
        });
        this.phoneticInput = text.inputEl;
      });

    // Meaning
    new Setting(contentEl)
      .setName('释义')
      .addTextArea((text) => {
        text
          .setPlaceholder('中文释义...')
          .setValue(this.entry.meaning)
          .onChange((v) => {
            this.entry.meaning = v;
          });
        this.meaningInput = text.inputEl;
        this.meaningInput.rows = 4;
      });

    // Note
    new Setting(contentEl)
      .setName('笔记')
      .addTextArea((text) => {
        text
          .setPlaceholder('个人笔记...')
          .setValue(this.entry.note || '')
          .onChange((v) => {
            this.entry.note = v;
          });
        this.noteInput = text.inputEl;
        this.noteInput.rows = 3;
      });

    // Action buttons
    const buttonRow = contentEl.createDiv('fleurdict-edit-modal-actions');

    const saveBtn = buttonRow.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => {
      this.onSave(this.entry);
      this.close();
    });

    const cancelBtn = buttonRow.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
