import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
// Alle Tools als Funktion kapseln
export function registerToolsPlaylist(server: McpServer, supabase: SupabaseClient<any>) {
  server.tool("get_playlists", "returns all playlists", {}, async () => {
    const { data, error } = await supabase.from("playlists").select("*");

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

    const playlistTexts = data.map(
      (playlist: any, idx: number) => `${idx + 1}. ${playlist.name || "Unbenannte Playlist"}`
    );
    const text =
      `Gefundene Playlists (${data.length}):\n` + playlistTexts.join("\n");

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
    "remove_playlist",
    "remove a playlist",
    {
      name: z.string().min(1).describe("playlist name"),
    },
    async ({ name }) => {
      // Supabase-Delete-Query mit Fehlerbehandlung
      const { data, error } = await supabase
        .from('playlists')
        .delete()
        .eq('name', name)
        .select();
  
      if (error) {
        return {
          content: [
            {
              type: "text",
              text: `Fehler beim Löschen der Playlist: ${error.message}`,
            },
          ],
        };
      }
  
      if (data.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Keine Playlist mit dem Namen "${name}" gefunden.`,
            },
          ],
        };
      }
  
      return {
        content: [
          {
            type: "text",
            text: `Playlist "${name}" wurde erfolgreich gelöscht.`,
          },
        ],
      };
    }
  );

  server.tool(
  "create_playlist",
  "create a new playlist for a user by first querying the user id",
{
    user_name: z.string().min(1).describe("user name"),
    playlist_name: z.string().min(1).describe("playlist name"),
  },
  async ({ user_name,playlist_name }) => {
  
    const { data: userData, error: userError} = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", user_name)
      .limit(1)
      .single();
    if (userError || !userData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `user '${user_name}' nicht gefunden.`,
          },
        ],
      };
    }
   

    const userId = userData.id;
   
    const { error } = await supabase
      .from("playlists")
      .insert({ name: playlist_name , user_id: userId })
      .select();

    if (error) {
      return {
        content: [
          {
            type: "text",
            text: `error by creating playlist ${error.message}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Playlist "${playlist_name}" succesfully created.`,
        },
      ],
    };
  }
);

 server.tool(
  "add_track_to_playlist",
  "add a track to a playlist for a user by first querying the user playlist id then querying the track id and finally inserting the track into the playlist",
{
  playlist_name: z.string().min(1).describe("playlist name"),
    track_name: z.string().min(1).describe("track name"),
    },
  async ({ playlist_name, track_name }) => {
  
    const { data: playlistData, error: playlistError} = await supabase
      .from("playlists")
      .select("id")
      .eq("name", playlist_name)
      .limit(1)
      .single();
    if (playlistError || !playlistData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `user '${playlist_name}' nicht gefunden.`,
          },
        ],
      };
    }
   

    const playlistId = playlistData.id;
   
    const { data: trackData, error: trackError } = await supabase
      .from("tracks")
      .select("trackid")
      .eq("title", track_name)
      .limit(1)
      .single();
    if (trackError || !trackData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `user '${track_name}' nicht gefunden.`,
          },
        ],
      };
    }
const trackId = trackData.trackid;
const { error } = await supabase
      .from("playlist_songs")
      .insert({ playlist_id: playlistId  , track_id: trackId })
      .select();

    if (error) {
      return {
        content: [
          {
            type: "text",
            text: `error by adding a track to playlist ${error.message}`,
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Playlist "${playlist_name}" succesfully created.`,
        },
      ],
    };
}
);
}
