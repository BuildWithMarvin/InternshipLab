import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
// Alle Tools als Funktion kapseln
export function registerToolsTracks(server: McpServer, supabase: SupabaseClient<any>) {
  
   server.tool("get_tracks", "returns all tracks", {}, async () => {
  const { data, error } = await supabase.from("tracks").select("*");

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
    (track, idx) =>
      `${idx + 1}. ${track.title || "unknown user"} (ID: ${
        track.trackid || "unbekannt"
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

server.tool(
  "get_tracks_by_artist",
  "returns all tracks for a given artist name by first querying the artist id",
  { artistname: z.string() },
  async ({ artistname }) => {


    const { data: artistData, error: artistError } = await supabase
      .from("artists")
      .select("artistid")
      .eq("artistname", artistname)
      .limit(1)
      .single();


    if (artistError || !artistData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Künstler '${artistname}' nicht gefunden.`,
          },
        ],
      };
    }


    const artistid = artistData.artistid;



    const { data: tracksData, error: tracksError } = await supabase
      .from("tracks")
      .select("title, trackid")
      .eq("artistid", artistid);


    if (tracksError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fehler beim Abrufen der Tracks: ${tracksError.message ?? "Unbekannter Fehler"}`,
          },
        ],
      };
    }


    if (!tracksData || tracksData.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Keine Tracks für Künstler '${artistname}' gefunden.`,
          },
        ],
      };
    }


    const trackTexts = tracksData.map(
      (track, idx) =>
        `${idx + 1}. ${track.title ?? "Unbekannter Track"} (ID: ${track.trackid ?? "unbekannt"})`
    );


    return {
      content: [
        {
          type: "text" as const,
          text: `Gefundene Tracks für '${artistname}' (${tracksData.length}):\n` + trackTexts.join("\n"),
        },
      ],
    };
  }
);
 
}