(function () {
  const catalog = document.getElementById("destinationCatalog");
  const search = document.getElementById("destinationSearch");
  const category = document.getElementById("categoryFilter");
  const sort = document.getElementById("sortFilter");
  const params = new URLSearchParams(location.search);

  if (params.get("search")) search.value = params.get("search");

  function durationLabel(minutes) {
    return minutes >= 60 ? `${Math.round(minutes / 60 * 10) / 10} ч` : `${minutes} мин`;
  }

  window.renderDestinations = function () {
    const term = search.value.trim().toLowerCase();
    let items = TRAVEL_DATA.filter(place =>
      (!term || `${place.name} ${place.city} ${place.country}`.toLowerCase().includes(term)) &&
      (!category.value || place.category === category.value)
    );
    items.sort((a, b) => sort.value === "rating" ? b.rating - a.rating : sort.value === "duration" ? b.duration - a.duration : b.popularity - a.popularity);

    catalog.innerHTML = items.length ? items.map(place => `
      <article class="place-card" id="place-${place.id}">
        <div class="place-card-image">
          <img src="${place.image}" alt="${place.name}">
          <button class="favorite-button ${isFavorite(place.id) ? "saved" : ""}" onclick="toggleFavorite('${place.id}')" aria-label="${isFavorite(place.id) ? "Удалить из избранного" : "Добавить в избранное"}">${iconMarkup("heart")}</button>
        </div>
        <div class="place-card-body">
          <div class="place-meta"><span>${iconMarkup("map-pin")} ${place.country} / ${place.city}</span><span>${iconMarkup("star")} ${place.rating}</span></div>
          <h3>${place.name}</h3>
          <p>${place.description}</p>
          <div class="place-meta"><span>${iconMarkup(categoryIcon(place.category))} ${place.categoryLabel}</span><span>${durationLabel(place.duration)}</span></div>
          <div class="card-actions" style="margin-top:16px">
            <a href="map.html?place=${place.id}">Посмотреть на карте</a>
            <button class="accent" onclick="addToPlanner('${place.id}')">В маршрут</button>
          </div>
        </div>
      </article>`).join("") : `<div class="empty-state">По вашему запросу ничего не найдено</div>`;
    renderTravelIcons(catalog);
  };

  window.addToPlanner = function(id) {
    let route = JSON.parse(localStorage.getItem("travelmap_route") || "[]");
    if (!route.includes(id)) {
      route.push(id);
      localStorage.setItem("travelmap_route", JSON.stringify(route));
      alert("Место добавлено в маршрут");
    } else alert("Это место уже есть в маршруте");
  };

  [search, category, sort].forEach(control => control.addEventListener("input", renderDestinations));
  renderDestinations();
})();
