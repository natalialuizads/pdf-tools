import { Injectable } from '@angular/core';
import { PDFDocument, PDFPage, PDFImage } from 'pdf-lib';

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

@Injectable({
  providedIn: 'root',
})
export class PdfMergerService {
  private readonly SUPPORTED_FILE_TYPES = {
    PDF: 'application/pdf',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
  };

  private readonly MAX_TOTAL_SIZE_BYTES = 7 * 1024 * 1024; // 7 MB

  async mergeFilesToPdf(files: File[]): Promise<Uint8Array> {
    this.validateFiles(files);
    this.validateTotalSize(files);

    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      await this.processFile(pdfDoc, file);
    }

    return this.savePdfAsUint8Array(pdfDoc);
  }

  private validateFiles(files: File[]): void {
    if (!files || files.length === 0) {
      throw new Error('No files provided to merge');
    }
  }

  private validateTotalSize(files: File[]): void {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (totalSize > this.MAX_TOTAL_SIZE_BYTES) {
      const maxSizeMB = this.MAX_TOTAL_SIZE_BYTES / (1024 * 1024);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Total file size (${totalSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`
      );
    }
  }

  private async processFile(pdfDoc: PDFDocument, file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const fileType = file.type;

    if (fileType === this.SUPPORTED_FILE_TYPES.PDF) {
      await this.mergePdfFile(pdfDoc, arrayBuffer);
    } else if (this.isImageFile(fileType)) {
      await this.mergeImageFile(pdfDoc, arrayBuffer, fileType);
    } else {
      console.warn(`Unsupported file type: ${fileType}`);
    }
  }

  private async mergePdfFile(pdfDoc: PDFDocument, arrayBuffer: ArrayBuffer): Promise<void> {
    try {
      const externalPdf = await PDFDocument.load(arrayBuffer);
      const pageIndices = externalPdf.getPageIndices();
      const copiedPages = await pdfDoc.copyPages(externalPdf, pageIndices);
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } catch (error) {
      console.error('Error merging PDF file:', error);
      throw new Error('Failed to merge PDF file');
    }
  }

  private async mergeImageFile(
    pdfDoc: PDFDocument,
    arrayBuffer: ArrayBuffer,
    fileType: string
  ): Promise<void> {
    try {
      const image = await this.embedImage(pdfDoc, arrayBuffer, fileType);
      if (image) {
        this.addImageToPage(pdfDoc, image);
      }
    } catch (error) {
      console.error('Error merging image file:', error);
      throw new Error('Failed to merge image file');
    }
  }

  private async embedImage(
    pdfDoc: PDFDocument,
    arrayBuffer: ArrayBuffer,
    fileType: string
  ): Promise<PDFImage | null> {
    switch (fileType) {
      case this.SUPPORTED_FILE_TYPES.JPEG:
        return pdfDoc.embedJpg(arrayBuffer);
      case this.SUPPORTED_FILE_TYPES.PNG:
        return pdfDoc.embedPng(arrayBuffer);
      default:
        console.warn(`Unsupported image type: ${fileType}`);
        return null;
    }
  }

  private isImageFile(fileType: string): boolean {
    return (
      fileType === this.SUPPORTED_FILE_TYPES.JPEG || fileType === this.SUPPORTED_FILE_TYPES.PNG
    );
  }

  private addImageToPage(pdfDoc: PDFDocument, image: PDFImage): void {
    const page = pdfDoc.addPage();
    const pageDimensions = this.getPageDimensions(page);
    const imageDimensions = this.getImageDimensions(image);
    const scaling = this.calculateImageScaling(imageDimensions, pageDimensions);

    page.drawImage(image, {
      x: scaling.x,
      y: scaling.y,
      width: scaling.width,
      height: scaling.height,
    });
  }

  private getPageDimensions(page: PDFPage): PageDimensions {
    return {
      width: page.getWidth(),
      height: page.getHeight(),
    };
  }

  private getImageDimensions(image: PDFImage): PageDimensions {
    return {
      width: image.width,
      height: image.height,
    };
  }

  private calculateImageScaling(
    imageDimensions: PageDimensions,
    pageDimensions: PageDimensions
  ): ImageScaling {
    const scaleFactor = Math.min(
      pageDimensions.width / imageDimensions.width,
      pageDimensions.height / imageDimensions.height
    );

    const scaledWidth = imageDimensions.width * scaleFactor;
    const scaledHeight = imageDimensions.height * scaleFactor;

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
}
