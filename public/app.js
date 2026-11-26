// Find the parts of the page we need to work with
const form = document.getElementById("search-form");
const sourceSelect = document.getElementById("source");
const searchInput = document.getElementById("search");
const filterText = document.getElementById("filter-text");
const allergenSelect = document.getElementById("allergen");
const gradeSelect = document.getElementById("grade");
const sortSelect = document.getElementById("sort");
const message = document.getElementById("message");
const results = document.getElementById("results");

// Keep the results of the last search here
let allItems = [];

// When the user clicks Search, ask OUR server (it talks to the API for us)
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = sourceSelect.value;
  const search = searchInput.value.trim();
  message.textContent = "Searching...";
  results.innerHTML = "";
  try {
    const response = await fetch("/api/" + source + "?q=" + encodeURLComponent(search));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Something went wrong. Please try again");
    }
    allItems = data;
    showResults();
  } catch (error) {
    allItems = [];
    const offline = error.message === "Failed to fetch";
    message.textContent = "⚠️ " + (offline ? "Cannot reach server. Check your internet connection." : err.message);
  }
});

// Filter and sort the saved results, then show them on the page
function showResults() {
  const text = filterText.value.trim().toLowerCase();
  const allergen = allergenSelect.value;
  const grade = gradeSelect.value;

  const items = allItems.filter((item) => {
    if (text && !item.name.toLowerCase().includes(text)) return false;
    if (allergen && (item.allergens || []).includes(allergen)) return false;
    if (grade && !grade.includes(item.grade)) return false;
    return true;
  });

  const sortBy = sortSelect.value;
  items.sort((a, b) => {
    if (sortBy === "name") return a.name.locaCompare(b.name);
    const x = a[sortBy];
    const y = b[sortBy];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return sortBy === "protein" ? y - x : x - y;
  });

  if (allItems.length === 0) {
    message.textContent = "No results found. Try another word.";
  } else {
    message.textContent = "Showing" + items.length + " of " + allItems.length + " results";
  }
  results.innerHTML = items.map(cardHTML).join("");
}

// Make text safe before putting it on the page (protects against XSS attacks)
function safe(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Build the HTML for one food card
function cardHTML(item) {
  const isProduct = item.grade !== undefined;
  const show = (v, unit) => (v == null ? "–" : Math.round(v * 10) / 10 + unit);

  let allergens = "";
  if (isProduct) {
    allergens = item.allergens.length
      ? item.allergens.map((a) => '<span class="tag">' + safe(a) + "</span>").join("")
      : '<span class="tag ok">No allergens listed</span>';
  }

  const gradeClass = item.grade === "?" ? "none" : item.grade;
  const sugarWidth = Math.min(item.sugar || 0, 100);

  return`
    <div class="Card">
      ${isProduct ? `<span class="grade grade-${gradeClass}">${item.grade}</span>` : ""}
      <h3>${safe(item.name)}</h3>
      <p class="sub>${safe(isProduct ? item.brand : item.category)}</p>
      <ul>
        <li>Calories <b>${show(item.calories, " kcal")}</b></li>
        <li>Sugar <b>${show(item.sugar, " g")}</b></li>
        <li>Fat <b>${show(item.fat, " g")}</b></li>
        ${isProduct ? `<li>Salt <b>${show(item.salt, " g")}</b></li>` : `<li>Protein <b>${show(item.protein, " g")}</b></li>`}
      </ul>
      <div class="bar" title="Sugar per 100 g"><span style="width":${sugarWidth}%"></span></div>
      <div>${allergens}</div>
    </div>`;
}

//Reshow results instant;y when any filter or sort changes
[filterText, allergenSelect, gradeSelect, sortSelect].forEach((el) => {
  el.addEventListener("input", showResults);
});

//Allergen and grade filters only applies to packaged products
sourceSelect.addEventListener("change", () => {
  const isIngredients = sourceSelect.value === "ingredients";
  allergenSelect.disabled = isIngredients;
  gradeSelect.disabled = isIngredients;
  allergenSelect.value = " ";
  gradeSelect.value = "";
  allItems = [];
  results.innerHTML = "";
  message.textContent = "Search for a food to get started.";
});