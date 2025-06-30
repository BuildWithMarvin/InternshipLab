import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
// Alle Tools als Funktion kapseln
export function registerToolsUsers(server: McpServer, supabase: SupabaseClient<any>) {
  
  server.tool("get_user", "returns all users", {}, async () => {
  const { data, error } = await supabase.from("profiles").select("*");

  if (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error fetching playlists: ${error.message ?? "Unknown error"}`,
        },
      ],
    };
  }

  if (!data || data.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "Keine Playlists gefunden.",
        },
      ],
    };
  }

  const profileTexts = data.map(
    (profile, idx) =>
      `${idx + 1}. ${profile.display_name || "unknown user"} (ID: ${
        profile.id || "unbekannt"
      })`
  );
  const text = `Gefundene user (${data.length}):\n` + profileTexts.join("\n");

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
});
 }