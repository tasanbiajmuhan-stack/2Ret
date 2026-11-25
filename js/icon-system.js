(function () {
  window.TRAVEL_ICONS = {
    country: "globe-2",
    city: "building-2",
    history: "landmark",
    nature: "trees",
    food: "utensils",
    shopping: "shopping-bag",
    hotel: "hotel",
    weather: "cloud-sun",
    popular: "star",
    photos: "star",
    favorite: "heart",
    route: "route",
    location: "map-pin",
    travel: "plane",
    architecture: "building-2",
    entertainment: "star",
    all: "globe-2"
  };

  window.iconMarkup = function (name, className = "", label = "") {
    const labelAttrs = label ? ` aria-label="${label}" role="img"` : ' aria-hidden="true"';
    return `<i data-lucide="${name}" class="lucide-icon ${className}"${labelAttrs}></i>`;
  };

  window.categoryIcon = function (category) {
    return TRAVEL_ICONS[category] || TRAVEL_ICONS.location;
  };

  window.renderTravelIcons = function (root = document) {
    if (window.lucide) {
      window.lucide.createIcons({
        attrs: {
          "stroke-width": 2,
          "aria-hidden": "true"
        },
        root
      });
    }
  };

  renderTravelIcons();
})();
