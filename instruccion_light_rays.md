# Instrucción para Implementar Efecto "Light Rays" en Landing Page

**Rol:** Eres un desarrollador experto en React y Frontend con ojo para el diseño (UI/UX).
**Objetivo:** Integrar un efecto de fondo animado ("Light Rays") en la sección Hero (parte superior) de la Landing Page actual.

## Contexto
El usuario tiene una Landing Page con un diseño limpio y claro (fondo blanco/sutil). Se desea agregar el efecto de "Rayos de Luz" que ya existe en la vista de Login, pero adaptado para que se proyecte desde la parte superior central hacia abajo.

## Pasos de Implementación

### 1. Crear Componente y Estilos
Asegúrate de que los siguientes archivos existan en la carpeta `components/`:

- `LightRays.tsx` (Código del componente WebGL/OGL)
- `LightRays.css` (Estilos contenedores)

*(Si no existen, utiliza el código proporcionado anteriormente para estos archivos).*

### 2. Integración en el Hero Section
Ubica el archivo principal de la Landing Page (ej. `App.tsx`, `LandingPage.tsx` o `Hero.tsx`).
Envuelve la sección Hero en un contenedor `relative` para posicionar los rayos detrás del texto.

**Configuración Sugerida (Para Tema Claro):**
Dado que el fondo es claro, los rayos blancos no se verán. Usa el color primario de la marca (Morado/Azul) con baja opacidad o un tono sutil para crear un efecto de "aurora" o "proyección".

```tsx
import LightRays from './components/LightRays';

// Dentro de tu componente Hero:
<section className="relative w-full overflow-hidden">
  
  {/* Capa de Efecto de Fondo */}
  <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
    <LightRays
      raysOrigin="top-center"       // Origen desde arriba al centro
      raysColor="#4F46E5"           // Color Indigo/Morado (ajustar a tu brand color)
      raysSpeed={0.2}               // Velocidad lenta para elegancia
      lightSpread={0.6}             // Dispersión media
      rayLength={1.5}               // Longitud para cubrir la sección
      followMouse={true}            // Interacción sutil
      mouseInfluence={0.05}         // Influencia baja para no marear
      className="opacity-20"        // Opacidad baja para que sea sutil sobre fondo blanco
    />
    
    {/* Degradado para suavizar el final de los rayos */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-white z-10"></div>
  </div>

  {/* Contenido Existente del Hero (Texto, Imágenes, Botones) */}
  <div className="relative z-20 container mx-auto px-4 ...">
      {/* ... tu contenido actual ... */}
  </div>

</section>
```

### 3. Ajustes de Diseño
*   **Contraste:** Verifica que el texto siga siendo legible. Si los rayos son oscuros, usa la propiedad `className="opacity-xx"` en el componente LightRays para suavizarlos.
*   **Performance:** El componente usa WebGL. Asegúrate de que no bloquee el scroll. (El componente ya tiene `pointer-events: none` en su CSS).
*   **Z-Index:** Es crucial que el `div` de los rayos tenga `z-0` y el contenido tenga `z-20` o superior para que los botones sigan siendo clickeables.

## Resultado Esperado
Un efecto de haces de luz sutiles y elegantes que emanan desde el borde superior de la pantalla hacia el centro, dando vida al fondo estático sin distraer de la propuesta de valor principal ("Tu aliado financiero...").
