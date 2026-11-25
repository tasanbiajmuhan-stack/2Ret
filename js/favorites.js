(function () {
  const catalog = document.getElementById("favoritesCatalog");

  window.renderFavorites = function () {
    const ids = JSON.parse(localStorage.getItem("travelmap_favorites") || "[]");
    const places = ids.map(id => TRAVEL_DATA.find(place => place.id === id)).filter(Boolean);
    catalog.innerHTML = places.length ? places.map(place => `
      <article class="place-card">
        <div class="place-card-image"><img src="${place.image}" alt="${place.name}"><button class="favorite-button saved" onclick="toggleFavorite('${place.id}') " aria-label="Удалить из избранного">${iconMarkup("heart")}</button></div>
        <div class="place-card-body">
          <div class="place-meta"><span>${iconMarkup("map-pin")} ${place.country} / ${place.city}</span><span>${iconMarkup("star")} ${place.rating}</span></div>
          <h3>${place.name}</h3>
          <p>${place.description}</p>
          <div class="place-meta"><span>${iconMarkup(categoryIcon(place.category))} ${place.categoryLabel}</span><span>${place.duration ? place.duration + " мин" : "Без ограничений"}</span></div>
          <div class="card-actions" style="margin-top:16px"><a href="map.html?place=${place.id}">Посмотреть на карте</a><button class="accent" onclick="addFavoriteToRoute('${place.id}')">В маршрут</button></div>
        </div>
      </article>`).join("") : `<div class="empty-state"><h3>В избранном пока пусто</h3><p>Найдите вдохновляющие места в каталоге.</p><a class="primary-button" href="destinations.html">Перейти к направлениям</a></div>`;
    renderTravelIcons(catalog);
  };

  window.addFavoriteToRoute = function(id) {
    const route = JSON.parse(localStorage.getItem("travelmap_route") || "[]");
    if (!route.includes(id)) {
      route.push(id);
      localStorage.setItem("travelmap_route", JSON.stringify(route));
      alert("Место добавлено в маршрут");
    } else alert("Это место уже есть в маршруте");
  };

  renderFavorites();
})();
