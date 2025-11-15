import { Injectable } from '@angular/core';
import { PDFDocument, PDFPage, PDFImage } from 'pdf-lib';

// ============ Types & Interfaces ============

interface PageDimensions {
  width: number;
  height: number;
}

interface ImageScaling {
  scaleFactor: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Serviço responsável APENAS pela unificação de PDFs e imagens
 * Sem validações - apenas processamento de merge
 */
@Injectable({
  providedIn: 'root',
})
export class PdfMergerService {
  private readonly SUPPORTED_FILE_TYPES = {
    PDF: 'application/pdf',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
  };

  /**
   * Unifica múltiplos PDFs e imagens em um único PDF
   * Pressupõe que as validações já foram feitas pelo PdfManager
   * @param files Array de arquivos (PDFs e imagens)
   * @returns PDF unificado como Uint8Array
   */
  async mergeFilesToPdf(files: File[]): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      await this.processFile(pdfDoc, file);
    }

    return this.savePdfAsUint8Array(pdfDoc);
  }

  private async processFile(pdfDoc: PDFDocument, file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const fileType = file.type;

    if (fileType === this.SUPPORTED_FILE_TYPES.PDF) {
      await this.mergePdfFile(pdfDoc, arrayBuffer);
    } else if (this.isImageFile(fileType)) {
      await this.mergeImageFile(pdfDoc, arrayBuffer, fileType);
    }
  }

  private async mergePdfFile(pdfDoc: PDFDocument, arrayBuffer: ArrayBuffer): Promise<void> {
    const srcPdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await pdfDoc.copyPages(srcPdf, srcPdf.getPageIndices());
    copiedPages.forEach((page) => pdfDoc.addPage(page));
  }

  private async mergeImageFile(
    pdfDoc: PDFDocument,
    arrayBuffer: ArrayBuffer,
    fileType: string
  ): Promise<void> {
    let imageData: PDFImage;

    if (fileType === this.SUPPORTED_FILE_TYPES.JPEG) {
      imageData = await pdfDoc.embedJpg(arrayBuffer);
    } else {
      imageData = await pdfDoc.embedPng(arrayBuffer);
    }

    const { width: imgWidth, height: imgHeight } = imageData.scale(1);
    const scaling = this.calculateImageScaling({ width: 595, height: 842 }, imgWidth, imgHeight);

    const page = pdfDoc.addPage([595, 842]);
    this.embedImage(page, imageData, scaling);
  }

  private embedImage(page: PDFPage, image: PDFImage, scaling: ImageScaling): void {
    page.drawImage(image, {
      x: scaling.x,
      y: page.getHeight() - scaling.y - scaling.height,
      width: scaling.width,
      height: scaling.height,
    });
  }

  private calculateImageScaling(
    pageDimensions: PageDimensions,
    imgWidth: number,
    imgHeight: number
  ): ImageScaling {
    const maxWidth = pageDimensions.width - 40;
    const maxHeight = pageDimensions.height - 40;

    const aspectRatio = imgWidth / imgHeight;
    let scaledWidth = maxWidth;
    let scaledHeight = maxWidth / aspectRatio;

    if (scaledHeight > maxHeight) {
      scaledHeight = maxHeight;
      scaledWidth = maxHeight * aspectRatio;
    }

    const scaleFactor = scaledWidth / imgWidth;

    return {
      scaleFactor,
      width: scaledWidth,
      height: scaledHeight,
      x: (pageDimensions.width - scaledWidth) / 2,
      y: (pageDimensions.height - scaledHeight) / 2,
    };
  }

  private async savePdfAsUint8Array(pdfDoc: PDFDocument): Promise<Uint8Array> {
    const pdfBytes = await pdfDoc.save();
    return new Uint8Array(pdfBytes);
  }

  private isImageFile(fileType: string): boolean {
    return (
      fileType === this.SUPPORTED_FILE_TYPES.JPEG || fileType === this.SUPPORTED_FILE_TYPES.PNG
    );
  }
}
