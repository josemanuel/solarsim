# Sistema Solar Interactivo (Three.js)

Modelo 3D interactivo del Sistema Solar construido con **Three.js**, HTML, CSS y JavaScript puro.  
Listo para desplegar en **GitHub Pages**.

**Autor:** José Manuel Fernández Carreira  

Creado como recordatorio del **eclipse total de Sol del 12 de agosto de 2026** en Avilés (Asturias).

## Características

- Posiciones planetarias basadas en elementos keplerianos aproximados (JPL, válidos ~1800–2050)
- Tiempo real o aceleración (desde 0.001× hasta ~10 000×)
- Ir a una fecha y hora concreta
- **Toggle** entre texturas procedurales (shaders) y texturas de imagen en `textures/`
- Órbitas elípticas dibujadas
- Lunas principales (Luna, Fobos, Deimos, Ío, Europa, Ganímedes, Calisto, Titán, Encélado, Tritón)
- Etiquetas CSS2D
- Zoom continuo y seguimiento de cámara sobre planetas/lunas
- Paralaje estelar y nebulosas interestelares procedurales
- Modal «Acerca de» con información de la app y del eclipse

## Estructura de archivos

```
index.html          UI y modal Acerca de
css/style.css       Estilos del panel y del modal
js/main.js          Three.js: órbitas, shaders, controles
textures/           Mapas planetarios + eclipse_aviles_2026.jpg
README.md           Este archivo
```

## Cómo usar localmente

```bash
npx serve .
# o
python -m http.server 8000
```

Abre la URL que indique el servidor (p. ej. `http://localhost:3000`).

## Despliegue en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube **todo** el contenido de esta carpeta (incluido `textures/`).
3. Settings → Pages → Deploy from a branch → `main` / root.
4. Abre `https://<usuario>.github.io/<repo>/`.

## Controles

| Acción | Cómo |
|--------|------|
| Rotar | Clic izquierdo + arrastrar |
| Zoom | Rueda del ratón |
| Pan | Clic derecho + arrastrar |
| Seguir cuerpo | Selector o clic sobre el planeta/luna |
| Vista general | Botón “Vista general” |
| Fecha concreta | Campo datetime + “Ir a fecha” |
| Velocidad | Slider (escala logarítmica) |
| Texturas imagen / procedural | Checkbox “Texturas de imagen” |
| Acerca de | Botón “Acerca de” |

## Licencia

Código libre para uso educativo y personal.  
Texturas planetarias basadas en Solar System Scope / NASA (CC BY 4.0).
