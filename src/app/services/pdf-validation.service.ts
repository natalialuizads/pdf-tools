import { Injectable } from '@angular/core';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Inicializar o worker do PDF.js usando arquivo local da pasta public
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PdfValidationResult {
  isValid: boolean;
  isEncrypted: boolean;
  requiresPassword: boolean;
  pageCount?: number;
  fileSize?: number;
  fileType?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PdfValidationService {
  /**
   * Valida um PDF e verifica se está protegido por senha
   * @param file Arquivo PDF a validar
   * @returns Resultado da validação com metadados
   */
  async validatePdf(file: File): Promise<PdfValidationResult> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.checkPdfEncryption(arrayBuffer, file);
    } catch (error) {
      return {
        isValid: false,
        isEncrypted: false,
        requiresPassword: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao validar PDF',
      };
    }
  }

  /**
   * Valida um PDF a partir de uma URL
   * @param url URL do PDF
   * @returns Resultado da validação
   */
  async validatePdfFromUrl(url: string): Promise<PdfValidationResult> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.checkPdfEncryption(arrayBuffer);
    } catch (error) {
      return {
        isValid: false,
        isEncrypted: false,
        requiresPassword: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar PDF da URL',
      };
    }
  }

  /**
   * Verifica se um PDF está encriptado e requer senha
   */
  private async checkPdfEncryption(
    arrayBuffer: ArrayBuffer,
    file?: File
  ): Promise<PdfValidationResult> {
    try {
      // Tenta carregar o documento sem senha
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      // Extrai metadados
      const metadata = await pdf.getMetadata().catch(() => null);
      const info = metadata?.info as { [key: string]: unknown } | undefined;

      // Se conseguiu carregar sem erro, o PDF não requer senha
      return {
        isValid: true,
        isEncrypted: false,
        requiresPassword: false,
        pageCount: pdf.numPages,
        fileSize: file?.size,
        fileType: file?.type,
        metadata: {
          title: info?.['Title'] ? String(info['Title']) : undefined,
          author: info?.['Author'] ? String(info['Author']) : undefined,
          subject: info?.['Subject'] ? String(info['Subject']) : undefined,
          keywords: info?.['Keywords'] ? String(info['Keywords']) : undefined,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

      // Verifica se o erro é relacionado a senha/encriptação
      if (
        errorMessage.includes('password') ||
        errorMessage.includes('encrypted') ||
        errorMessage.includes('Authentication') ||
        errorMessage.includes('needs password')
      ) {
        return {
          isValid: true,
          isEncrypted: true,
          requiresPassword: true,
          fileSize: file?.size,
          fileType: file?.type,
          error: 'Este PDF está protegido por senha',
        };
      }

      // Se for outro tipo de erro, o PDF pode ser inválido
      return {
        isValid: false,
        isEncrypted: false,
        requiresPassword: false,
        fileSize: file?.size,
        fileType: file?.type,
        error: errorMessage,
      };
    }
  }
}
