(function () {
  const favorites = JSON.parse(localStorage.getItem("travelmap_favorites") || "[]");

  function syncFavoriteCounts() {
    document.querySelectorAll(".favorite-count").forEach(el => {
      el.textContent = JSON.parse(localStorage.getItem("travelmap_favorites") || "[]").length;
    });
  }

  window.toggleFavorite = function (id) {
    let saved = JSON.parse(localStorage.getItem("travelmap_favorites") || "[]");
    saved = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    localStorage.setItem("travelmap_favorites", JSON.stringify(saved));
    syncFavoriteCounts();
    if (typeof window.renderFavorites === "function") window.renderFavorites();
    if (typeof window.renderDestinations === "function") window.renderDestinations();
  };

  window.isFavorite = id => JSON.parse(localStorage.getItem("travelmap_favorites") || "[]").includes(id);
  window.syncFavoriteCounts = syncFavoriteCounts;
  syncFavoriteCounts();

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  if (toggle && nav) toggle.addEventListener("click", () => nav.classList.toggle("open"));

  const featured = document.getElementById("featuredDestinations");
  if (featured) {
    const ids = ["big-almaty-lake", "kok-tobe", "cathedral"];
    featured.innerHTML = ids.map(id => {
      const place = TRAVEL_DATA.find(item => item.id === id);
      return `<a class="destination-card" href="destinations.html?place=${place.id}">
        <img src="${place.image}" alt="${place.name}">
        <div class="destination-info"><h3>${iconMarkup("building-2")} ${place.city}</h3><p>${place.name} / ${place.duration} мин</p><span class="card-arrow">${iconMarkup("arrow-right")}</span></div>
      </a>`;
    }).join("");
    renderTravelIcons(featured);
  }

  const searchForm = document.getElementById("heroSearch");
  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      const query = document.getElementById("globalSearch").value.trim();
      window.location.href = `destinations.html${query ? `?search=${encodeURIComponent(query)}` : ""}`;
    });
  }
})();
