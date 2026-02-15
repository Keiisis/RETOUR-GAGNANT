export const CLIENT_THEME = {
    colors: {
        background: "#05080a", // Noir ébène profond
        card: "#0f141e",       // Gris ardoise sombre
        primary: "#FCD116",    // Or Royal (Akan)
        secondary: "#008751",  // Vert Forêt Sacrée
        accent: "#E8112D",     // Terre Rouge (Latérite)
        text: "#ececec",       // Blanc cassé (Ivoire)
        muted: "#8899a6",      // Gris métal
    },
    gradients: {
        royal: "linear-gradient(135deg, #FCD116 0%, #D4AF37 100%)",
        forest: "linear-gradient(135deg, #008751 0%, #004d2e 100%)",
        earth: "linear-gradient(135deg, #E8112D 0%, #8B0000 100%)",
        night: "linear-gradient(to bottom, #05080a, #0f141e)",
    },
    shadows: {
        neoglow: "0 0 20px rgba(252, 209, 22, 0.15)",
        depth: "0 10px 30px -10px rgba(0, 0, 0, 0.8)",
    },
    fonts: {
        heading: "var(--font-poppins), sans-serif",
        body: "var(--font-inter), sans-serif",
    }
};
