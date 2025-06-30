import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
// Alle Tools als Funktion kapseln
export function registerToolsArtists(server: McpServer, supabase: SupabaseClient<any>) {
  
   server.tool("get_artists", "returns all artists", {}, async () => {
  const { data, error } = await supabase.from("artists").select("*");

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
          text: "no artist found.",
        },
      ],
    };
  }

  const profileTexts = data.map(
    (artist, idx) =>
      `${idx + 1}. ${artist.artistname || "unknown user"} (ID: ${
        artist.artistid || "unbekannt"
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