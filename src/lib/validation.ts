import { z } from "zod";

// Azure DevOps organization name validation
// Alphanumeric, hyphens, underscores, max 255 chars
export const orgSchema = z
  .string()
  .min(1, "Organization name is required")
  .max(255, "Organization name too long")
  .regex(/^[a-zA-Z0-9-_]+$/, "Organization name can only contain letters, numbers, hyphens, and underscores");

// PAT validation - Azure DevOps PATs are base64-encoded, 52 chars
export const patSchema = z
  .string()
  .min(20, "PAT appears invalid (too short)")
  .max(1024, "PAT too long")
  .regex(/^[a-zA-Z0-9+/=_-]+$/, "PAT contains invalid characters");

// Project name validation
export const projectNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[^<>:"\/\\|?*\x00-\x1F]+$/, "Project name contains invalid characters");

// API request schemas
export const feedRequestSchema = z.object({
  org: orgSchema,
  pat: patSchema,
  hours: z.union([z.number().int().min(1).max(8760), z.null()]).optional(), // Max 1 year or null for all-time
  projects: z.union([z.array(projectNameSchema).max(100), z.null()]).optional(), // Max 100 projects or null for all
  prTop: z.number().int().min(1).max(200).optional(), // Max 200 PRs
  wiTop: z.number().int().min(1).max(500).optional(), // Max 500 work items
});

export const projectsRequestSchema = z.object({
  org: orgSchema,
  pat: patSchema,
});

export type FeedRequest = z.infer<typeof feedRequestSchema>;
export type ProjectsRequest = z.infer<typeof projectsRequestSchema>;

// Sanitize error messages for client consumption
export function sanitizeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const firstError = error.issues?.[0];
    return firstError?.message ?? "Validation error";
  }
  
  if (error instanceof Error) {
    const message = error.message;
    
    // Remove potentially sensitive information
    const sanitized = message
      .replace(/Bearer [a-zA-Z0-9+/=_-]+/gi, "Bearer [REDACTED]")
      .replace(/Basic [a-zA-Z0-9+/=_-]+/gi, "Basic [REDACTED]")
      .replace(/[a-z0-9]{52}/gi, "[REDACTED_TOKEN]")
      .replace(/authorization:[^\n]*/gi, "authorization: [REDACTED]")
      .slice(0, 200); // Limit error message length
    
    // Only show generic messages for certain error types
    if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) {
      return "Unable to connect to Azure DevOps. Please check your organization name.";
    }
    
    if (message.includes("401") || message.includes("Unauthorized")) {
      return "Authentication failed. Please check your Personal Access Token.";
    }
    
    if (message.includes("403") || message.includes("Forbidden")) {
      return "Access denied. Your PAT may not have sufficient permissions.";
    }
    
    if (message.includes("404") || message.includes("Not Found")) {
      return "Resource not found. Please check your organization and project names.";
    }
    
    return sanitized || "An error occurred";
  }
  
  return "An unexpected error occurred";
}
