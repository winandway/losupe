import { getDb } from "@/lib/db";
import { crearPase } from "@/lib/anti-bots";

/**
 * El pase del formulario y la trampa para robots, en una sola pieza.
 *
 * Va dentro de cada formulario público. El pase lo firma el servidor al pintar la página, así que
 * quien manda un POST directo —como hace casi todo el spam— no lo tiene. La trampa es un campo que
 * una persona no ve nunca: si viene relleno, era un robot.
 */
export async function CampoPase() {
  let pase = "";
  try {
    pase = await crearPase(await getDb());
  } catch {
    /* sin base, el formulario sigue funcionando: no se deja a nadie fuera por esto */
  }
  return (
    <>
      <input type="hidden" name="pase" value={pase} />
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Web
          <input name="web" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}
