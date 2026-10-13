export function normalizeCommand(text) {
    return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseCommand(text, economies) {
    const command = normalizeCommand(text).replace(/^please\s+/, "").replace(/\s+please$/, "");
    if (/^reset(?: the)?(?: maps?| views?)?$/.test(command)) return {type: "reset"};
    const match = command.match(/^(?:highlight|select)\s+(?:the\s+)?(.+)$/);
    if (!match) return {type: "error", message: "Try “highlight Japan” or “reset”."};
    const aliases = new Map(economies.flatMap(d => [[normalizeCommand(d.country), d.iso3], [normalizeCommand(d.iso3), d.iso3]]));
    const commonNames = {
        "united states of america": "USA", "america": "USA", "us": "USA", "u s": "USA", "u s a": "USA",
        "uk": "GBR", "u k": "GBR", "britain": "GBR", "great britain": "GBR",
        "south korea": "KOR", "republic of korea": "KOR", "hong kong": "HKG",
        "russia": "RUS", "turkey": "TUR", "czechia": "CZE", "czech republic": "CZE",
        "uae": "ARE", "u a e": "ARE", "viet nam": "VNM"
    };
    for (const [name, iso3] of Object.entries(commonNames)) aliases.set(name, iso3);
    const iso3 = aliases.get(match[1]);
    return iso3 && economies.some(d => d.iso3 === iso3)
        ? {type: "select", iso3}
        : {type: "error", message: "That name is not in the 50-economy list. Use a full name from the menu."};
}
