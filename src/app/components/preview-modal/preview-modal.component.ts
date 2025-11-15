import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { PdfManager } from '../../services/pdf-merger.service';

@Component({
  selector: 'app-preview-modal',
  standalone: true,
  imports: [CommonModule, PdfViewerModule],
  template: `
    @if (pdfManager.isPreviewOpenSignal()) {
    <div class="modal-overlay" (click)="closePreview()">
      <div class="modal-container" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>{{ pdfManager.previewContentSignal()?.fileName || 'Preview' }}</h2>
          <button class="close-button" (click)="closePreview()">
            <span>&times;</span>
          </button>
        </div>

        <div class="modal-content">
          @if (pdfManager.previewContentSignal()) { @if (pdfManager.previewContentSignal()!.type ===
          'application/pdf') {
          <pdf-viewer
            [src]="pdfManager.previewContentSignal()!.url"
            [render-text]="true"
            [original-size]="false"
            [fit-to-page]="true"
            class="pdf-viewer"
          ></pdf-viewer>
          } @else if (pdfManager.previewContentSignal()!.type.startsWith('image/')) {
          <img [src]="pdfManager.previewContentSignal()!.url" alt="Preview" class="image-preview" />
          } }
        </div>
      </div>
    </div>
    }
  `,
  styles: `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease-in-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      width: 90%;
      max-width: 900px;
      height: 90vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.5rem;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .close-button {
      background: none;
      border: none;
      font-size: 2rem;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        background-color: #f0f0f0;
        color: #333;
      }

      span {
        line-height: 1;
      }
    }

    .modal-content {
      flex: 1;
      overflow: auto;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pdf-viewer {
      width: 100%;
      height: 100%;
    }

    .image-preview {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    @media (max-width: 768px) {
      .modal-container {
        width: 95%;
        height: 95vh;
      }

      .modal-header h2 {
        font-size: 1.2rem;
      }
    }
  `,
})
export class PreviewModalComponent {
  pdfManager = inject(PdfManager);

  closePreview(): void {
    this.pdfManager.closePreview();
  }
}
