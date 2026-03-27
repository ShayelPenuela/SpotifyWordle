const express = require("express");

const app = express();
const PORT = 3000;

app.get("/api/top-songs", (req, res) => {
    res.json([
        { title: "Blinding Lights", artist: "The Weeknd" },
        { title: "Levitating", artist: "Dua Lipa" },
        { title: "As It Was", artist: "Harry Styles" }
    ]);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
