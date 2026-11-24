//Use IPv4 first (fixes "fetch failed" on WSL)
require("dns").setDefaultResultOrder("ipv4first");
require("net").setDefaultAutoSelectFamily(false);

// Load the secret key from the .env file
require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const USDA_KEY = process.env.USDA_API_KEY;

//Show the website files (HTML, CSS, JS) from the "public" folder
app.use(express.static("public"));

//Remember recent answers for 10 minutes, so we don't ask the API again and again
const cache = {};
const TEN_MINUTES = 10 * 60 * 1000;

//Get data from a URL, using the cache if we already have it
async function getData(url, headers = {}) {
    const saved = cache[url];
    if (saved && Date.now() - saved.time < TEN_MINUTES) {
        return saved.data;
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error("API answered with status " + response.status);
    }
    const data = await response.json();
    cache[url] = { data: data, time: Date.now() };
    return data;
}

//Search packaged products (Open Food Facts API - no key needed)
app.get("/api/products", async (req, res) => {
    const search = (req.query.q || "").trim();
    if (search.length < 2 || search.length > 50) {
        return res.status(400).json({ error: "Please type 2 to 50 letters to search." });
    }
    const fields = "code,product_name,brands,image_small_url,nutriscore_grade,allergens_tags,nutriments";
      const url = "https://search.openfoodfacts.org/search?q=" + encodeURIComponent(search) +
    "&page_size=24&fields=" + fields;
    try {
        const data = await getData(url, { "User-Agent": "FoodCheck/1.0 (student project)" });
        const products = (data.hits || []).map((p) => ({
            name: p.product_name || "Unnamed product",
            brand: [].concat(p.brands || "Unknown brand").join(", "),
            image: p.image_small_url || "",
            grade: ["a","b","c","d","e"].includes(p.nutriscore_grade) ? p.nutriscore_grade.toUpperCase() : "?",
            allergens: (p.allergens_tags || []).map((a) => a.replace("en:", "")),
            sugar: p.nutriments?.sugars_100g ?? null,
            fat: p.nutriments?.fat_100g ?? null,
            salt: p.nutriments?.salt_100g ?? null,
            calories: p.nutriments?.["energy-kcal_100g"] ?? null,
        }));
        res.json(products);
    } catch (err) {
        console.error("Open Food Facts error:", err.message);
        res.status(502).json({ error: "The food database is not responding. Please try again later." });
    }
});

//Search raw ingredients (USDA FoodData Central API - needs secret key)
app.get("/api/ingredients", async (req, res) => {
    const search = (req.query.q || "").trim();
    if (search.length < 2 || search.length > 50) {
        return res.status(400).json({ error: "Please type 2 to 50 letters to search." });
    }
    if (!USDA_KEY) {
        return res.status(500).json({ error: "Server is missing the USDA API key." });
    }
    const url = "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + USDA_KEY +
        "&query=" + encodeURIComponent(search) +
        "&pageSize=24&dataType=" + encodeURIComponent("Foundation,SR Legacy");

    try {
        const data = await getData(url);
        const ingredients = (data.foods || []).map((food) => {
            //Find one  nutrient by its USDA number (e.g "203" = Protein)
            const find = (...numbers) => {
                const n = (food.foodNutrients || []).find((x) => numbers.includes(String(x.nutrientNumber)));
                return n ? Math.round(n.value * 10) / 10 : null;
            };
            return {
                name: food.description || "Unnamed ingredient",
                category: food.foodCategory || "Other",
                calories: find("208", "957", "958"),
                protein: find("203"),
                fat: find("204"),
                carbs: find("205"),
                sugar: find("269"),
                sodium: find("307"),
            };
        });
        res.json(ingredients);
    } catch (err) {
            console.error("USDA error:", err.message, err.cause ? err.cause.code : "");
        res.status(502).json({ error: "The ingredient database is not responding. Please try again later." });
    }
});

//Health check: shows which server answered (useful to test load balance)
const os = require("os");
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", server: os.hostname() });
});

//Start the server
app.listen(PORT, () => {
    console.log("FoodCheck is running on http://localhost:" + PORT);
});