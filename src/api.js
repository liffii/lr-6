export async function omdbRequest(apiKey, params, signal) {
  const url = new URL("https://www.omdbapi.com/");
  url.search = new URLSearchParams({ apikey: apiKey, ...params }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== "object")
    throw new Error("Некорректный ответ сервера");
  return data;
}

export function filterByYear(movies, from, to) {
  return movies.filter((movie) => {
    const year = Number.parseInt(movie.Year, 10);
    if (from === "" && to === "") return true;
    return (
      Number.isFinite(year) &&
      (from === "" || year >= Number(from)) &&
      (to === "" || year <= Number(to))
    );
  });
}

export function validateYears(from, to) {
  if (
    [from, to].some(
      (value) =>
        value !== "" && (!/^\d{4}$/.test(value) || Number(value) < 1800),
    )
  )
    return "Укажите год четырьмя цифрами, начиная с 1800";
  if (from && to && Number(from) > Number(to))
    return "Год «от» не может быть больше года «до»";
  return "";
}

export function loadHistory() {
  try {
    const data = JSON.parse(
      window.localStorage.getItem("lr6-search-history") || "[]",
    );
    return Array.isArray(data)
      ? data
          .filter((item) => typeof item === "string" && item.trim())
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function addToHistory(history, query) {
  return [
    query,
    ...history.filter((item) => item.toLowerCase() !== query.toLowerCase()),
  ].slice(0, 5);
}
