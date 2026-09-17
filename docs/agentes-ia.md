# losupe para agentes de IA

> Cómo un asistente de inteligencia artificial (Claude, ChatGPT, Gemini, Perplexity…) encuentra,
> lee y cita losupe. Escrito el 17 de septiembre de 2026.

## Por qué importa

Cada vez más gente pregunta en un asistente en vez de buscar en Google. Si el asistente puede leer
losupe sin pelearse con el HTML, nos cita con el enlace; si no, cita a otro. Esto es posicionamiento,
solo que en el buscador nuevo.

Se mide con el escáner de Cloudflare: abre `https://isitagentready.com`, escribe `losupe.com` y dale
a escanear.

## Lo que losupe le ofrece hoy a un agente

| Puerta                       | Dirección                                                | Para qué                                                       |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| **Servidor MCP**             | `https://losupe.com/mcp`                                 | Buscar y leer notas desde el propio asistente, sin llaves      |
| Tarjeta del servidor MCP     | `https://losupe.com/.well-known/mcp/server-card.json`    | Para que el asistente descubra el servidor antes de conectarse |
| auth.md                      | `https://losupe.com/auth.md`                             | Dice que no hace falta ninguna credencial, y por qué           |
| Guía para modelos            | `https://losupe.com/llms.txt`                            | Mapa del sitio en texto plano                                  |
| Catálogo de IA               | `https://losupe.com/.well-known/ai-catalog.json`         | Índice de todo lo anterior                                     |
| Catálogo de API (RFC 9727)   | `https://losupe.com/.well-known/api-catalog`             | Lo mismo en el formato estándar de APIs                        |
| Habilidad (skill)            | `https://losupe.com/.well-known/agent-skills/index.json` | Instrucciones listas para un agente con skills                 |
| Cualquier página en Markdown | la misma URL con `Accept: text/markdown`                 | Texto limpio, sin menús ni publicidad                          |
| Feeds y mapas                | `/es/rss.xml`, `/en/rss.xml`, `/sitemap.xml`             | Lo de siempre                                                  |

## El servidor MCP, en cristiano

MCP (Model Context Protocol) es el enchufe estándar entre un asistente de IA y una fuente de datos.
El nuestro es **público y de solo lectura**: cualquiera puede conectarlo, nadie puede escribir nada.

Cuatro herramientas:

| Herramienta     | Qué hace                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `search_news`   | Busca notas por palabra clave. Devuelve titular, resumen, fecha y enlace |
| `latest_news`   | Las más recientes, de una sección o de todas                             |
| `read_article`  | Una nota completa en Markdown, con autor, fechas y sus fuentes           |
| `list_sections` | Las secciones del diario en los dos idiomas                              |

Cada respuesta termina recordando que se cite el enlace. Y el sitio declara Content Signals
`search=yes, ai-input=yes, ai-train=no`: se puede leer y citar, no entrenar modelos.

### Cómo se conecta alguien

En Claude (Settings → Connectors → Add custom connector) o en cualquier cliente MCP que acepte un
servidor remoto, se pega esta dirección:

```
https://losupe.com/mcp
```

No pide usuario, ni contraseña, ni token.

### Cómo se comprueba a mano

```bash
curl -s https://losupe.com/mcp -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tiene que responder las cuatro herramientas. El saludo (`initialize`) devuelve
`serverInfo.name = "com.losupe/news"`.

## Por qué NO publicamos OAuth

El escáner marca en rojo `/.well-known/oauth-authorization-server` y
`/.well-known/oauth-protected-resource`. Están así a propósito: **no hay nada protegido**. Todo lo
que servimos a un agente es público, y publicar metadatos de autenticación sin un servidor detrás
manda al agente a una puerta que no abre — peor que no tener nada. El día que se venda acceso por
volumen, se publican los dos junto con el servidor de verdad. Mientras tanto, `auth.md` lo dice con
todas las letras.

Lo mismo con A2A (agente contra agente): losupe no ejecuta tareas para otros agentes, publica
noticias.

## Lo que falta: DNS-AID

Es el descubrimiento por DNS: un agente pregunta al DNS de `losupe.com` qué agentes tiene. Hacen
falta dos registros `SVCB` en la zona y, si se puede, DNSSEC. **No se puede hacer desde el código:**
lo tiene que crear quien administra la zona. Los valores exactos están en
[`PENDIENTES.md`](../PENDIENTES.md).

## Dónde vive esto en el código

- `src/lib/mcp.ts` — el servidor, sus herramientas y la tarjeta.
- `src/lib/agent-manifests.ts` — catálogo de IA, habilidad y `auth.md`.
- `src/lib/agent-discovery.ts` — `robots.txt`, `llms.txt`, catálogo de API y cabecera `Link`.
- `worker.ts` — las rutas (`/mcp`, `/.well-known/mcp/server-card.json`, `/auth.md`).
- Candado 54 en [`candados.md`](candados.md).
