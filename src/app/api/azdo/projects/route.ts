import { listProjects } from "@/lib/azdo";
import { projectsRequestSchema, sanitizeError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Verify request has custom header (CSRF protection)
    const requestedWith = req.headers.get("X-Requested-With");
    if (!requestedWith || requestedWith !== "XMLHttpRequest") {
      return Response.json(
        { error: "Invalid request" },
        { status: 403 },
      );
    }

    const body = await req.json();
    
    // Validate input
    const validated = projectsRequestSchema.parse(body);

    const projects = await listProjects(validated.org, validated.pat);
    return Response.json({ projects });
  } catch (err) {
    const message = sanitizeError(err);
    const status = err instanceof Error && err.message.includes("Validation") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
