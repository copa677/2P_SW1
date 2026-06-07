import { Component, output } from '@angular/core';

@Component({
  selector: 'app-palette',
  standalone: true,
  templateUrl: './palette.component.html'
})
export class PaletteComponent {
  // Angular 20 output api
  readonly elementSelected = output<string>();

  selectElement(type: string) {
    this.elementSelected.emit(type);
  }
}
