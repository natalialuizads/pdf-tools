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
      // ⚡ Otimização: Verificar primeiros bytes para detectar PDF válido
      const view = new Uint8Array(arrayBuffer);
      const header = String.fromCharCode(...view.slice(0, 5));

      if (header !== '%PDF-') {
        return {
          isValid: false,
          isEncrypted: false,
          requiresPassword: false,
          fileSize: file?.size,
          fileType: file?.type,
          error: 'Arquivo não é um PDF válido (header inválido)',
        };
      }

      // ⚡ Otimização: Procurar por "Encrypt" nos primeiros 10KB (rápido)
      const firstChunk = view.slice(0, Math.min(10000, view.length));
      const chunkText = String.fromCharCode(...firstChunk);
      const hasEncrypt = chunkText.includes('/Encrypt');

      if (hasEncrypt) {
        // Pode ser um PDF com senha - tenta carregar para confirmar
        try {
          const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            disableAutoFetch: true, // ⚡ Não busca dados adicionais
            rangeChunkSize: 32768, // ⚡ Tamanho menor para range requests
          });

          // ⚡ Timeout de 3s para evitar esperar muito
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 3000)
          );

          await Promise.race([loadingTask.promise, timeoutPromise]);

          return {
            isValid: true,
            isEncrypted: false,
            requiresPassword: false,
            fileSize: file?.size,
            fileType: file?.type,
          };
        } catch (innerError) {
          // Provavelmente requer senha
          const errorMsg = innerError instanceof Error ? innerError.message : '';
          if (
            errorMsg.includes('password') ||
            errorMsg.includes('Authentication') ||
            errorMsg.includes('timeout')
          ) {
            return {
              isValid: true,
              isEncrypted: true,
              requiresPassword: true,
              fileSize: file?.size,
              fileType: file?.type,
              error: 'PDF está protegido por senha',
            };
          }
        }
      }

      // ⚡ Se passou pelas verificações, assumir que é válido (sem parse completo)
      return {
        isValid: true,
        isEncrypted: false,
        requiresPassword: false,
        fileSize: file?.size,
        fileType: file?.type,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

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
