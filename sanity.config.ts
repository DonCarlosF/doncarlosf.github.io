"use client";

/**
 * Sanity Studio config — mounted in-app at /studio so staff edit content with
 * zero code. Connect a project by setting NEXT_PUBLIC_SANITY_PROJECT_ID
 * (and dataset) in the environment, then run `npx sanity init` if needed.
 */
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "@/sanity/env";
import { schema } from "@/sanity/schemaTypes";
import { structure } from "@/sanity/structure";

export default defineConfig({
  basePath: "/studio",
  projectId: projectId || "placeholder",
  dataset,
  schema,
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: apiVersion })],
});
