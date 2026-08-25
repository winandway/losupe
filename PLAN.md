# Plan: preparar losupe.com para Google Noticias

Auditoría previa (24 ago 2026) — lo que **ya estaba hecho** y no se toca:

- `NewsArticle` / `Article` en JSON-LD con `datePublished` y `dateModified`.
- `https://losupe.com/news-sitemap.xml` con ventana de 48 h y etiquetas `<news:news>`.
- La firma de cada nota ya enlaza al perfil del autor (`Byline` → `/es/autor/...`).
- Páginas de acerca, política editorial, privacidad y términos.

Lo que falta, en orden de importancia para el visto bueno de Google:

- [x] 1. Página de **Contacto** dedicada y bilingüe, con formulario que llega de verdad al correo,
      dirección de correo visible, entidad responsable y tiempo de respuesta.
- [x] 2. Página de **Equipo editorial** ("quiénes somos" ampliada): misión del medio, cómo
      trabajamos, y la ficha de cada persona de la redacción con foto, cargo y enlace a su perfil.
- [x] 3. **Redes y credenciales de los autores**: columnas nuevas en `authors` (LinkedIn, X, correo
      profesional), mostradas en su perfil y publicadas en JSON-LD como `sameAs`, que es lo que
      Google cruza para verificar a una persona.
- [x] 4. **Enlaces institucionales visibles**: Contacto y Equipo en el pie de página y en el menú,
      en los dos idiomas.
- [x] 5. **Datos estructurados al día**: `ProfilePage` con las redes, `ContactPage` en la de
      contacto, y comprobar que las fechas salen con zona horaria explícita.
- [x] 6. **Frescura de la portada**: que lo reciente mande y el archivo viejo no se mezcle con la
      actualidad del día.
- [x] 7. **Mapas del sitio**: incluir las páginas nuevas en `sitemap.xml` y comprobar que
      `news-sitemap.xml` sigue correcto.
- [x] 8. **Candado y documentación**: pruebas que se pongan rojas si desaparece una página
      institucional o si un autor se queda sin perfil enlazado; entrada en `docs/candados.md` y
      guía en `docs/`.
- [x] 9. **Verificación completa y publicación**: `npm run verify`, pruebas de navegador en móvil,
      capturas y `git push`.

Queda para Richard (no es trabajo mío): alta en Google Publisher Center, y darme los datos que solo
él tiene — correo de contacto público, entidad legal y los perfiles reales de LinkedIn/X del equipo.

---

# Plan: la mesa de redacción (el jefe que decide QUÉ se escribe)

Pedido por Richard el 24 ago 2026, viendo que el robot escribe bien pero solo reacciona a lo que le
traen las fuentes: _«deberíamos tener un cerebro, que sería como el gerente que prepara todo antes de
llegar a la IA que escribe… el que manda al redactor»_. Y con un género concreto que hoy no
existe: **las curiosidades y las listas**, que es lo que la gente lee y comparte.

Lo que hoy se pierde: los diez años sin Juan Gabriel, las lluvias de Venezuela, «10 curiosidades
sobre las ventas por Internet», «los 10 errores más grandes de las empresas chinas».

- [x] 10. **La mesa de redacción** (`mesa.ts`): decide el género de cada turno —actualidad, pieza
      propia o efeméride— con un reparto configurable, en vez de escribir siempre lo que trajo el RSS.
- [x] 11. **Banco de ideas propias** (`ideas.ts`): plantillas de curiosidades y listas por sección
      («10 curiosidades sobre…», «los 10 errores más grandes de…»), con los temas de cada sección.
- [x] 12. **Efemérides del día**: qué se cumple hoy, desde una fuente pública y citable, para no
      volver a perder un aniversario que le importa a la gente.
- [x] 13. **El redactor sabe escribir listas**: un modo propio en el prompt, porque una lista de diez
      curiosidades no se escribe como una noticia.
- [x] 14. **Todo verificable**: las curiosidades también citan de dónde salen. Nada inventado, que es
      justo el riesgo de este género.
- [x] 15. **Control en el panel**: cuánto de actualidad y cuánto de piezas propias, y el banco de
      ideas a la vista.
- [x] 16. **Candado, documentación, pruebas y publicación.**
