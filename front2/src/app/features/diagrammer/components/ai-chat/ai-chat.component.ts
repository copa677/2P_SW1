import { Component, input, output, inject, signal, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../../../core/services/agent.service';
import { SpeechService } from '../../../../core/services/speech.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html'
})
export class AiChatComponent implements AfterViewChecked {
  private readonly agentService = inject(AgentService);
  private readonly speechService = inject(SpeechService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  // Inputs y Outputs basados en Signals
  readonly diagramState = input<any>(null);
  readonly editable = input<boolean>(true);
  readonly diagramUpdated = output<any>();

  // Estado del chat
  readonly messages = signal<ChatMessage[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de diagramación. Puedo ayudarte a crear, eliminar o mover elementos y calles dentro del diagrama, así como agregar campos de formulario a los nodos de actividad. ¿En qué te puedo colaborar hoy?'
    }
  ]);
  
  readonly promptText = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly isListening = signal<boolean>(false);

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  sendMessage() {
    const text = this.promptText().trim();
    if (!text || this.isLoading()) return;

    if (!this.editable()) {
      this.messages.update(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: 'Lo siento, no tienes permisos para editar este diagrama, por lo que no puedo realizar cambios en él.' }
      ]);
      this.promptText.set('');
      return;
    }

    // Agregar mensaje del usuario a la lista
    this.messages.update(prev => [...prev, { role: 'user', content: text }]);
    this.promptText.set('');
    this.isLoading.set(true);

    // Preparar historial excluyendo el primer saludo estático
    const rawHistory = this.messages().slice(1, -1).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const currentState = this.diagramState();

    this.agentService.postDiagramChat(text, currentState, rawHistory).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        
        // Agregar respuesta de la IA
        this.messages.update(prev => [...prev, { role: 'assistant', content: res.response }]);
        
        // Disparar actualización del diagrama en el lienzo
        if (res.diagram) {
          this.diagramUpdated.emit(res.diagram);
        }
      },
      error: (err) => {
        console.error('Error in agent chat:', err);
        this.isLoading.set(false);
        this.messages.update(prev => [
          ...prev,
          { role: 'assistant', content: 'Disculpa, ocurrió un error de comunicación con el backend del agente de IA.' }
        ]);
      }
    });
  }

  toggleSpeech() {
    if (this.isListening()) {
      this.speechService.stopListening();
      this.isListening.set(false);
    } else {
      this.isListening.set(true);
      this.speechService.startListening()
        .then((text: string) => {
          this.promptText.set(text);
          this.isListening.set(false);
          // Opcionalmente enviar el mensaje de forma automática
          this.sendMessage();
        })
        .catch((err: any) => {
          console.error('Speech recognition error:', err);
          this.isListening.set(false);
        });
    }
  }
}
