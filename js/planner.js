(function () {
  const dayNames = ["Знакомство с городом", "Природа", "Горы", "Культура", "Развлечения", "Пригород", "Свободный день", "Исследование района", "Местная кухня", "Возвращение"];
  const dayColors = ["#d96f32", "#2c7a65", "#8d6bb8", "#d4a72c", "#dc6678", "#3d82c4", "#60796a", "#b85d43", "#a77d2d", "#477f83"];
  const cards = document.getElementById("dayCards");
  const form = document.getElementById("plannerForm");
  let planner = JSON.parse(localStorage.getItem("travelmap_planner") || "null");

  function defaultPlanner(count) {
    const almatyIds = ["panfilov","cathedral","bazaar","big-almaty-lake","kok-tobe","shymbulak","medeu","museum","republic","navat"];
    const days = Array.from({length:count}, () => []);
    almatyIds.forEach((id, index) => days[Math.min(index, count - 1)].push(id));
    if (count >= 7) {
      days[6].push("kok-tobe");
      days[6] = [...new Set(days[6])];
    }
    return { title:"Маршрут по Алматы", city:"Алматы", country:"Казахстан", days, date:"", budget:"comfort" };
  }

  if (!planner) planner = defaultPlanner(7);

  function haversine(a, b) {
    const r = 6371;
    const p = Math.PI / 180;
    const dLat = (b.lat-a.lat)*p, dLng = (b.lng-a.lng)*p;
    const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLng/2)**2;
    return 2*r*Math.asin(Math.sqrt(h));
  }

  function routeDistance(ids) {
    let km = 0;
    const places = ids.map(id => TRAVEL_DATA.find(place => place.id === id)).filter(Boolean);
    for (let i=1;i<places.length;i++) km += haversine(places[i-1], places[i]);
    return km;
  }

  function formatDate(offset) {
    if (!planner.date) return "";
    const date = new Date(planner.date + "T12:00:00");
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString("ru-RU", {day:"numeric", month:"short"});
  }

  function render() {
    document.getElementById("itineraryTitle").textContent = `Маршрут на ${planner.days.length} ${planner.days.length === 7 ? "дней" : "дня"}`;
    const allIds = planner.days.flat();
    const minutes = allIds.reduce((sum,id) => sum + (TRAVEL_DATA.find(place => place.id === id)?.duration || 0), 0);
    let km = 0;
    planner.days.forEach(ids => km += routeDistance(ids));
    document.getElementById("tripSummary").innerHTML = `<span>${planner.city || "Алматы"} / ${planner.country || "Казахстан"}</span><span>${allIds.length} локаций</span><span>${Math.round(minutes/60)} ч посещений</span><span>Около ${Math.round(km)} км по маршруту</span>`;

    cards.innerHTML = planner.days.map((ids, dayIndex) => {
      const places = ids.map(id => TRAVEL_DATA.find(place => place.id === id)).filter(Boolean);
      return `<article class="day-card" style="--day-color:${dayColors[dayIndex % dayColors.length]}">
        <div class="day-card-head"><span class="day-number">${dayIndex+1}</span><div><h3>День ${dayIndex+1} - ${dayNames[dayIndex] || "Свободный день"}</h3><p>${formatDate(dayIndex) || "Дата не выбрана"} / ${places.length} локаций / ${routeDistance(ids) ? "Около " + Math.round(routeDistance(ids)) + " км" : "Маршрут собирается"}</p></div></div>
        <div class="day-card-body">${places.map((place, placeIndex) => `
          <div class="route-place" draggable="true" data-day="${dayIndex}" data-place="${place.id}">
            <img src="${place.image}" alt="${place.name}">
            <div><h4>${place.name}</h4><p>${iconMarkup(categoryIcon(place.category))} ${place.categoryLabel} / ${place.duration ? place.duration + " мин" : "Без ограничений"} / ${place.address}</p></div>
            <div class="place-controls">
              <button title="Выше" onclick="movePlace(${dayIndex},${placeIndex},-1)">${iconMarkup("chevron-up")}</button>
              <button title="Ниже" onclick="movePlace(${dayIndex},${placeIndex},1)">${iconMarkup("chevron-down")}</button>
              <select title="Перенести в день" onchange="transferPlace(${dayIndex},${placeIndex},this.value)"><option value="">Перенести</option>${planner.days.map((_, i) => `<option value="${i}" ${i === dayIndex ? "disabled" : ""}>День ${i+1}</option>`).join("")}</select>
              <button title="Удалить" onclick="removePlace(${dayIndex},${placeIndex})">${iconMarkup("trash-2")}</button>
            </div>
          </div>`).join("")}
          <div class="add-place-row"><select id="addSelect-${dayIndex}"><option value="">Добавить место...</option>${TRAVEL_DATA.map(place => `<option value="${place.id}">${place.name}</option>`).join("")}</select><button title="Добавить" onclick="addPlace(${dayIndex})">${iconMarkup("plus")}</button></div>
        </div>
      </article>`;
    }).join("");
    renderTravelIcons(cards);
  }

  window.movePlace = function(day, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= planner.days[day].length) return;
    [planner.days[day][index], planner.days[day][target]] = [planner.days[day][target], planner.days[day][index]];
    render();
  };
  window.transferPlace = function(day, index, target) {
    if (target === "") return;
    const id = planner.days[day].splice(index, 1)[0];
    planner.days[Number(target)].push(id);
    render();
  };
  window.removePlace = function(day, index) {
    planner.days[day].splice(index,1);
    render();
  };
  window.addPlace = function(day) {
    const select = document.getElementById(`addSelect-${day}`);
    if (!select.value) return;
    planner.days[day].push(select.value);
    render();
  };

  form.addEventListener("submit", event => {
    event.preventDefault();
    const count = Number(document.getElementById("dayCount").value);
    const city = document.getElementById("city").value;
    const country = document.getElementById("country").value;
    const interests = [...form.querySelectorAll(".interest-grid input:checked")].map(input => input.value);
    let pool = TRAVEL_DATA.filter(place => place.city === city);
    if (!pool.length) pool = TRAVEL_DATA.filter(place => place.country === country);
    if (!pool.length) pool = TRAVEL_DATA;
    const byInterest = pool.filter(place => interests.includes(place.category));
    if (byInterest.length) pool = byInterest.concat(pool.filter(place => !byInterest.includes(place)));
    const days = Array.from({length:count}, () => []);
    pool.slice(0, Math.max(count * 2, 10)).forEach((place, index) => days[index % count].push(place.id));
    planner = {title:`Маршрут по ${city}`,city,country,days,date:document.getElementById("startDate").value,budget:document.getElementById("budget").value};
    render();
  });

  document.getElementById("saveRoute").addEventListener("click", () => {
    localStorage.setItem("travelmap_planner", JSON.stringify(planner));
    localStorage.setItem("travelmap_route", JSON.stringify(planner.days.flat()));
    const button = document.getElementById("saveRoute");
    button.textContent = "Сохранено";
    setTimeout(() => button.textContent = "Сохранить", 1600);
  });
  document.getElementById("printRoute").addEventListener("click", () => window.print());
  render();
})();
