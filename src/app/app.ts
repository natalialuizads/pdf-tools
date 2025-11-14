import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PdfImageViewerComponent } from './components/pdf-image-viewer/pdf-image-viewer.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PdfImageViewerComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pdf-tools');
}
