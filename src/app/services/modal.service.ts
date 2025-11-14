import { Injectable } from '@angular/core';
import { signal, Signal } from '@angular/core';

export interface ModalContent {
  url: string;
  type: string;
  fileName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private isOpen = signal<boolean>(false);
  private content = signal<ModalContent | null>(null);

  readonly isModalOpen: Signal<boolean> = this.isOpen.asReadonly();
  readonly modalContent: Signal<ModalContent | null> = this.content.asReadonly();

  openModal(modalContent: ModalContent): void {
    this.content.set(modalContent);
    this.isOpen.set(true);
  }

  closeModal(): void {
    this.revokeObjectUrl();
    this.isOpen.set(false);
    this.content.set(null);
  }

  private revokeObjectUrl(): void {
    const currentContent = this.content();
    if (currentContent?.url) {
      URL.revokeObjectURL(currentContent.url);
    }
  }
}
