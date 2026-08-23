import { buildRobotsTxt } from "@/lib/agent-discovery";
import { baseUrlFromRequest } from "@/lib/site";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return new Response(buildRobotsTxt(baseUrlFromRequest(request)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
