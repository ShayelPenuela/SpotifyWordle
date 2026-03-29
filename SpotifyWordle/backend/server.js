const path = require("path");
require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Debug on startup
console.log("=== ENV DEBUG ===");
console.log("CLIENT ID:", process.env.SPOTIFY_CLIENT_ID || "UNDEFINED ❌");
console.log("CLIENT SECRET:", process.env.SPOTIFY_CLIENT_SECRET ? "Loaded ✅" : "Missing ❌");
console.log("=================");

app.get("/", (req, res) => {
    res.send("Backend is running");
});

async function getSpotifyAccessToken() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env");
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        "grant_type=client_credentials",
        {
            headers: {
                Authorization: `Basic ${authHeader}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout: 15000
        }
    );

    return response.data.access_token;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function spotifyGetWithBackoff(url, config, retries = 2) {
    try {
        return await axios.get(url, { ...config, timeout: 15000 });
    } catch (error) {
        const status = error.response?.status;
        const retryAfter = error.response?.headers?.["retry-after"];

        if (status === 429 && retries > 0) {
            const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 2;
            await sleep(waitSeconds * 1000);
            return spotifyGetWithBackoff(url, config, retries - 1);
        }

        throw error;
    }
}

app.get("/api/top-songs", async (req, res) => {
    try {
        const token = await getSpotifyAccessToken();

        const response = await spotifyGetWithBackoff(
            "https://api.spotify.com/v1/search",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: {
                    q: "year:2013",
                    type: "track",
                    limit: 2
                }
            }
        );

        const tracks = response.data?.tracks?.items || [];

        const songs = [];

        for (const track of tracks) {
            if (!track || !track.artists || track.artists.length === 0) continue;

            const artist = track.artists[0];

            // 🔥 NEW: fetch artist details
            const artistResponse = await spotifyGetWithBackoff(
                `https://api.spotify.com/v1/artists/${artist.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const artistData = artistResponse.data;

            songs.push({
                title: track.name,
                artist: artist.name,

                // 🎯 LARGE ARTIST IMAGE
                artistImage: artistData.images?.[0]?.url || null,

                // optional extras
                popularity: track.popularity,
                album: track.album.name
            });
        }

        res.json(songs);

    } catch (error) {
        console.error("Spotify error:", error.response?.data || error.message);

        res.status(500).json({
            error: "Failed to fetch artist image",
            details: error.response?.data || error.message
        });
    }
});

// app.get("/api/top-songs", async (req, res) => {
//     res.json([
//         { title: "CHANGED RIGHT NOW", artist: "TEST VALUE" }
//     ]);
// });

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});