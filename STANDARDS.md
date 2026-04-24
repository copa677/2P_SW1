# Estándares de Codificación del Proyecto

Este documento establece las guías técnicas y estándares de calidad para el desarrollo de los componentes Frontend (`front_1erP`) y Backend (`back_1erP`).

---

## 🎨 Frontend (Angular 20+)

Seguiremos las prácticas de "Modern Angular" recomendadas oficialmente.

### Principios Clave:
- **Standalone Components**: No usaremos `NgModules`. Los componentes, directivas y pipes son independientes por defecto.
- **Signals**: Uso obligatorio de `signal()`, `computed()`, `input()` y `output()` para el manejo de estado reactivo y flujo de datos.
- **Inyección con `inject()`**: Preferencia por la función `inject()` sobre la inyección por constructor para una mayor claridad y soporte de tipos.
- **Control Flow Nativo**: Uso de sintaxis `@if`, `@for`, `@switch` en los templates.
- **Estrategia OnPush**: Todos los componentes deben usar `changeDetection: ChangeDetectionStrategy.OnPush`.
- **Estandarización de Estilos**: Uso de CSS nativo con variables en el `:host` para temas y consistencia.

### Referencias:
- [Guía oficial de IA y Mejores Prácticas de Angular](https://angular.dev/ai/develop-with-ai)
- [Documentación de Signals](https://angular.dev/guide/signals)
- [Control Flow en Angular](https://angular.dev/guide/templates/control-flow)

---

## ⚙️ Backend (Spring Boot 4.x / Java 21)

El backend se construirá bajo una arquitectura limpia y aprovechando las últimas mejoras de Java.

### Principios Clave:
- **Arquitectura de Capas**: 
    - `Controller`: Manejo de peticiones y respuestas (usando DTOs).
    - `Service`: Lógica de negocio pura (capa intermedia).
    - `Repository`: Interacción con MongoDB a través de Spring Data.
    - `Model`: Entidades que representan los documentos en la base de datos.
- **Java Records para DTOs**: Uso de `record` para objetos de transferencia de datos inmutables.
- **Hilos Virtuales**: Activación de Java 21 Virtual Threads para escalabilidad masiva.
- **Manejo Global de Excepciones**: Uso de `@RestControllerAdvice` para centralizar los errores.
- **Validación**: Uso de anotaciones JSR-303 (`@NotNull`, `@Size`, etc.) y `@Valid`.
- **Lombok**: Para reducir el código repetitivo en modelos y servicios.
- **Constructor Injection**: Uso de `@RequiredArgsConstructor` de Lombok para inyección de dependencias.

### Referencias:
- [Documentación de Spring Boot 3/4](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Java 21 Virtual Threads Guide](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)
- [Spring Data MongoDB](https://docs.spring.io/spring-data/mongodb/docs/current/reference/html/)

---

## 🛠️ Convenciones Comunes
- **API Versioning**: Todos los endpoints deben comenzar con `/api/v1/`.
- **Nombrado JSON**: Usaremos `snake_case` para las propiedades de las APIs.
- **Git**: Commits descriptivos y uso correcto de `.gitignore` para evitar subir archivos sensibles o binarios.
