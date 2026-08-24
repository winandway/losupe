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
