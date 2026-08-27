/**
 * La dirección desde la que llega una petición.
 *
 * Se usa SOLO para contar (límite de envíos por hora) y para la huella anónima del contador de
 * lectores. **No se guarda en ninguna tabla**.
 */
export function ipDe(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}
