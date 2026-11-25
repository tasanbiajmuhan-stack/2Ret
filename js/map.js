require([
  "esri/config",
  "esri/Map",
  "esri/views/SceneView",
  "esri/widgets/Search",
  "esri/widgets/Zoom",
  "esri/layers/FeatureLayer",
  "esri/layers/GraphicsLayer",
  "esri/Graphic",
  "esri/rest/locator",
  "esri/core/reactiveUtils"
], function(esriConfig, Map, SceneView, Search, Zoom, FeatureLayer, GraphicsLayer, Graphic, locator, reactiveUtils) {
  if (window.TRAVELMAP_ARCGIS_API_KEY) {
    esriConfig.apiKey = window.TRAVELMAP_ARCGIS_API_KEY;
  }

  const status = document.getElementById("mapStatus");
  const loading = document.getElementById("globeLoading");
  const panel = document.getElementById("globePanel");
  const panelContent = document.getElementById("globePanelContent");

  const map = new Map({
    basemap: "satellite",
    ground: "world-elevation"
  });

  const view = new SceneView({
    container: "viewDiv",
    map,
    center: [30, 20],
    zoom: 2,
    viewingMode: "global",
    ui: { components: ["attribution"] },
    environment: {
      atmosphere: { enabled: true },
      starsEnabled: true,
      lighting: { type: "sun" }
    },
    qualityProfile: "medium"
  });

  view.ui.remove("zoom");

  const zoomWidget = new Zoom({ view });
  view.ui.add(zoomWidget, "bottom-right");

  const countries = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    outFields: ["*"],
    opacity: 1,
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",
        symbolLayers: [{
          type: "fill",
          material: { color: [16, 62, 50, 0.18] },
          outline: { color: [184, 211, 199, 0.7], size: 0.7 }
        }]
      }
    },
    spatialReference: { wkid: 4326 }
  });
  map.add(countries);

  const cityLayer = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Cities/FeatureServer/0",
    outFields: ["*"],
    visible: false,
    renderer: {
      type: "simple",
      symbol: {
        type: "point-3d",
        symbolLayers: [{
          type: "icon",
          resource: { primitive: "circle" },
          size: 5,
          material: { color: [246, 184, 126, 1] },
          outline: { color: [255, 255, 255, 0.9], size: 1 }
        }]
      }
    },
    featureReduction: {
      type: "cluster",
      clusterRadius: 55,
      clusterMinSize: 22,
      clusterMaxSize: 38,
      labelingInfo: [{
        deconflictionStrategy: "none",
        labelExpressionInfo: { expression: "$feature.cluster_count" },
        symbol: {
          type: "text",
          color: [255, 255, 255, 1],
          haloColor: [22, 56, 45, 0.9],
          haloSize: 1,
          font: { family: "Manrope", size: 11, weight: "bold" }
        }
      }]
    }
  });
  map.add(cityLayer);

  const highlightLayer = new GraphicsLayer({ title: "Выбранная территория" });
  const travelLayer = new GraphicsLayer({ title: "Туристические объекты" });
  const routeLayer = new GraphicsLayer({ title: "Маршрут" });
  map.addMany([routeLayer, highlightLayer, travelLayer]);

  let highlightHandle = null;
  const cityQueryCache = new window.Map();

  function attributeValue(attributes, names) {
    for (const name of names) {
      if (attributes[name] !== undefined && attributes[name] !== null && attributes[name] !== "") {
        return attributes[name];
      }
    }
    return "";
  }

  function placeName(attributes) {
    return attributeValue(attributes, ["NAME", "NAME_EN", "COUNTRY", "COUNTRYAFF", "CITY_NAME", "CNTRY_NAME", "Match_addr"]) ||
      "Название недоступно";
  }

  function openPanel(title, subtitle, details, iconName = "map-pin") {
    panelContent.innerHTML = `
      <p class="eyebrow dark">${iconMarkup(iconName)} Географический объект</p>
      <h1>${title}</h1>
      ${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ""}
      ${details ? `<div class="panel-details">${details}</div>` : ""}
    `;
    panel.classList.add("open");
    renderTravelIcons(panelContent);
  }

  function countryDetails(attributes) {
    const country = placeName(attributes);
    const population = attributeValue(attributes, ["POP", "POP_CNTRY", "POPULATION"]);
    const capital = attributeValue(attributes, ["CAPITAL", "Capital", "CAPITAL_EN"]);
    return [
      population ? `<span><strong>Население</strong>${population.toLocaleString ? population.toLocaleString("ru-RU") : population}</span>` : "",
      capital ? `<span><strong>Столица</strong>${capital}</span>` : "",
      `<span><strong>Страна</strong>${country}</span>`
    ].filter(Boolean).join("");
  }

  function cityDetails(attributes) {
    const country = attributeValue(attributes, ["CNTRY_NAME", "COUNTRY", "COUNTRYAFF"]);
    const region = attributeValue(attributes, ["ADM1NAME", "REGION", "STATE_NAME", "ADMIN1"]);
    const population = attributeValue(attributes, ["POP", "POPULATION", "POP_MAX", "POP_MIN"]);
    return [
      country ? `<span><strong>Страна</strong>${country}</span>` : "",
      region ? `<span><strong>Регион</strong>${region}</span>` : "",
      population ? `<span><strong>Население</strong>${population.toLocaleString ? population.toLocaleString("ru-RU") : population}</span>` : ""
    ].filter(Boolean).join("");
  }

  async function updateCitiesByScale() {
    const currentZoom = view.zoom;

    if (currentZoom < 4) {
      cityLayer.visible = true;
      cityLayer.featureReduction = {
        type: "cluster",
        clusterRadius: 55,
        clusterMinSize: 20,
        clusterMaxSize: 34
      };
      status.textContent = "Столицы и крупные города";
    } else {
      cityLayer.visible = true;
      cityLayer.featureReduction = null;
      status.textContent = currentZoom >= 10
        ? "Населенные пункты и доступные географические объекты"
        : "Крупные и небольшие города";
    }
  }

  async function queryCitiesAt(viewExtent) {
    if (!viewExtent) return;
    const cacheKey = [
      view.zoom.toFixed(1),
      viewExtent.xmin.toFixed(2),
      viewExtent.ymin.toFixed(2),
      viewExtent.xmax.toFixed(2),
      viewExtent.ymax.toFixed(2)
    ].join(":");
    if (cityQueryCache.has(cacheKey)) return;
    cityQueryCache.set(cacheKey, Date.now());
    if (cityQueryCache.size > 24) {
      const oldestKey = cityQueryCache.keys().next().value;
      cityQueryCache.delete(oldestKey);
    }
    try {
      const query = cityLayer.createQuery();
      query.geometry = viewExtent;
      query.spatialRelationship = "intersects";
      query.outFields = ["*"];
      query.returnGeometry = true;
      query.num = view.zoom >= 10 ? 500 : view.zoom >= 6 ? 300 : 200;
      await cityLayer.queryFeatures(query);
    } catch (error) {
      console.warn("Не удалось загрузить населенные пункты:", error);
      status.textContent = "Данные населенных пунктов временно недоступны";
    }
  }

  function highlightCountry(graphic) {
    if (highlightHandle) highlightHandle.remove();
    highlightHandle = view.whenLayerView(countries).then(layerView => {
      highlightHandle = layerView.highlight(graphic);
    });

    highlightLayer.removeAll();
    highlightLayer.add(new Graphic({
      geometry: graphic.geometry,
      symbol: {
        type: "polygon-3d",
        symbolLayers: [{
          type: "fill",
          material: { color: [217, 111, 50, 0.28] },
          outline: { color: [255, 196, 130, 1], size: 2 }
        }]
      }
    }));

    const attributes = graphic.attributes || {};
    openPanel(placeName(attributes), "Государственная граница", countryDetails(attributes), "globe-2");

    view.goTo({
      target: graphic.geometry,
      tilt: 35,
      heading: view.camera.heading
    }, { duration: 1800, easing: "in-out-expo" });
  }

  function renderTravelPlaces() {
    travelLayer.removeAll();
    const ids = JSON.parse(localStorage.getItem("travelmap_route") || "[]");
    const savedPlanner = JSON.parse(localStorage.getItem("travelmap_planner") || "null");
    if (savedPlanner?.days?.length) {
      savedPlanner.days.flat().forEach(id => {
        if (!ids.includes(id)) ids.push(id);
      });
    }

    ids.map(id => TRAVEL_DATA.find(place => place.id === id)).filter(Boolean).forEach(place => {
      travelLayer.add(new Graphic({
        geometry: { type: "point", longitude: place.lng, latitude: place.lat },
        symbol: {
          type: "point-3d",
          symbolLayers: [{
            type: "icon",
            resource: { primitive: "pin-tent" },
            size: 18,
            material: { color: [217, 111, 50, 1] },
            outline: { color: [255, 255, 255, 1], size: 1.5 }
          }]
        },
        attributes: { id: place.id, name: place.name },
        popupTemplate: {
          title: place.name,
          content: `<div class="globe-popup">
            <p>${place.categoryLabel}</p>
            <p>${place.description}</p>
          </div>`
        }
      }));
    });
  }

  const worldGeocoder = "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";

  const search = new Search({
    view,
    container: "mapSearch",
    includeDefaultSources: true,
    sources: [
      {
        locator: { url: worldGeocoder },
        name: "World",
        placeholder: "Страна, город, адрес или достопримечательность",
        outFields: ["Match_addr", "PlaceName", "Place_addr", "Type", "Country", "Region", "Subregion"]
      }
    ],
    resultGraphicEnabled: false,
    popupEnabled: true
  });

  search.on("select-result", event => {
    const feature = event.result.feature;
    const geometry = feature.geometry;
    const attributes = feature.attributes || {};
    const title = attributeValue(attributes, ["PlaceName", "Match_addr", "text"]) || "Найденное место";
    const subtitle = attributeValue(attributes, ["Place_addr", "Match_addr", "Address"]) || "";
    const details = [
      attributeValue(attributes, ["Country"]) ? `<span><strong>Страна</strong>${attributeValue(attributes, ["Country"])}</span>` : "",
      attributeValue(attributes, ["Region"]) ? `<span><strong>Регион</strong>${attributeValue(attributes, ["Region"])}</span>` : "",
      attributeValue(attributes, ["Subregion"]) ? `<span><strong>Район</strong>${attributeValue(attributes, ["Subregion"])}</span>` : "",
      attributeValue(attributes, ["Type"]) ? `<span><strong>Тип</strong>${attributeValue(attributes, ["Type"])}</span>` : ""
    ].filter(Boolean).join("");

    openPanel(title, subtitle, details, "map-pin");
    view.goTo({
      target: geometry,
      zoom: 12,
      tilt: 55
    }, { duration: 2200, easing: "in-out-expo" });
  });

  view.on("click", async event => {
    try {
      const response = await view.hitTest(event);
      const countryResult = response.results.find(result => result.graphic?.layer === countries);
      if (countryResult) {
        highlightCountry(countryResult.graphic);
        return;
      }

      const cityResult = response.results.find(result => result.graphic?.layer === cityLayer);
      if (cityResult) {
        const attributes = cityResult.graphic.attributes || {};
        const title = placeName(attributes);
        openPanel(title, "Населенный пункт", cityDetails(attributes), "building-2");
        view.goTo({
          target: cityResult.graphic.geometry,
          zoom: Math.max(view.zoom + 2, 9),
          tilt: 45
        }, { duration: 1500, easing: "in-out-expo" });
      }
    } catch (error) {
      console.warn("Не удалось определить объект:", error);
    }
  });

  reactiveUtils.watch(
    () => view.stationary,
    stationary => {
      if (!stationary) return;
      updateCitiesByScale();
      queryCitiesAt(view.extent);
    }
  );

  document.getElementById("zoomIn").addEventListener("click", () => {
    view.goTo({ center: view.center, zoom: view.zoom + 1 }, { duration: 700, easing: "in-out-expo" });
  });

  document.getElementById("zoomOut").addEventListener("click", () => {
    view.goTo({ center: view.center, zoom: view.zoom - 1 }, { duration: 700, easing: "in-out-expo" });
  });

  document.getElementById("resetGlobe").addEventListener("click", () => {
    if (highlightHandle?.remove) highlightHandle.remove();
    highlightLayer.removeAll();
    panel.classList.remove("open");
    view.goTo({
      center: [30, 20],
      zoom: 2,
      tilt: 0,
      heading: 0
    }, { duration: 2200, easing: "in-out-expo" });
  });

  document.getElementById("panelClose").addEventListener("click", () => panel.classList.remove("open"));

  const paramPlace = new URLSearchParams(location.search).get("place");
  if (paramPlace) {
    const place = TRAVEL_DATA.find(item => item.id === paramPlace);
    if (place) {
      openPanel(place.name, place.categoryLabel, `
        <span><strong>Местоположение</strong>${place.address}</span>
        <span><strong>Посещение</strong>${place.duration ? place.duration + " мин" : "По запросу"}</span>
        <span><strong>Рейтинг</strong>${place.rating}</span>
      `, "star");
    }
  }

  view.when(() => {
    loading?.classList.add("hidden");
    status.textContent = "Глобус готов";
    renderTravelPlaces();
    updateCitiesByScale();

    if (paramPlace) {
      const place = TRAVEL_DATA.find(item => item.id === paramPlace);
      if (place) {
        view.goTo({
          target: [place.lng, place.lat],
          zoom: 12,
          tilt: 55
        }, { duration: 2200, easing: "in-out-expo" });
      }
    }
  }).catch(error => {
    loading?.classList.add("hidden");
    status.textContent = "Глобус не удалось загрузить";
    openPanel("Сервис недоступен", "", "<span><strong>Ошибка</strong>Проверьте подключение к интернету или ключ ArcGIS.</span>", "cloud-sun");
    console.error(error);
  });
});
