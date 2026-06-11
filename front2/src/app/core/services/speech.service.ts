import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private recognition: any;
  private isListening = false;

  constructor() {
    const { SpeechRecognition, webkitSpeechRecognition }: any = window as any;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;
    
    if (Recognition) {
      this.recognition = new Recognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'es-ES';
    }
  }

  public startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject('Reconocimiento de voz no soportado en este navegador.');
        return;
      }

      if (this.isListening) {
        this.recognition.stop();
      }

      this.isListening = true;

      this.recognition.onresult = (event: any) => {
        this.isListening = false;
        const text = event.results[0][0].transcript;
        resolve(text);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        reject(event.error);
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.isListening = false;
          reject('No se detectó audio o el reconocimiento terminó.');
        }
      };

      try {
        this.recognition.start();
      } catch (e) {
        this.isListening = false;
        reject('Error iniciando el micrófono.');
      }
    });
  }

  public stopListening() {
    if (this.recognition) {
      this.isListening = false;
      this.recognition.stop();
    }
  }
}
