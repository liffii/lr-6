import { useEffect, useRef, useState } from "react";
import { MovieCard } from "./components/MovieCard.jsx";
import {
  addToHistory,
  filterByYear,
  loadHistory,
  omdbRequest,
  validateYears,
} from "./api.js";

export default function App() {
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_OMDB_API_KEY || "");
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [total, setTotal] = useState(0);
  const [details, setDetails] = useState({});
  const [autoSearch, setAutoSearch] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const busy = useRef(false);
  const cache = useRef(new Map());
  const sequence = useRef(0);

  function startSearch(text, page = 1) {
    if (busy.current) return;
    const title = text.trim();
    if (!title) {
      setError("Введите название фильма");
      return;
    }
    if (!apiKey.trim()) {
      setError("Введите API-ключ OMDb");
      return;
    }
    busy.current = true;
    setStatus("loading");
    setError(null);
    setMovies([]);
    setDetails({});
    setRequest({
      query: title,
      page,
      key: apiKey.trim(),
      id: ++sequence.current,
    });
  }
  useEffect(() => {
    if (!request) return;
    busy.current = true;
    const controller = new AbortController();
    const { signal } = controller;
    async function search() {
      try {
        const data = await omdbRequest(
          request.key,
          { s: request.query, type: "movie", page: String(request.page) },
          signal,
        );
        if (signal.aborted) return;
        if (data.Response === "False" || data.Error) {
          if (/movie not found/i.test(data.Error || "")) {
            setTotal(0);
            setStatus("success");
            return;
          }
          throw new Error(data.Error || "Не удалось выполнить поиск");
        }
        if (!Array.isArray(data.Search))
          throw new Error("Сервер вернул некорректный список фильмов");
        const results = data.Search.filter(
          (movie) => movie && movie.imdbID && movie.Title,
        );
        setMovies(results);
        setTotal(Number(data.totalResults) || results.length);
        setStatus("success");
        setHistory((current) => addToHistory(current, request.query));
        let next = 0;
        async function worker() {
          while (next < results.length && !signal.aborted) {
            const movie = results[next++];
            const cacheId = `${request.key}:${movie.imdbID}`;
            let detail = cache.current.get(cacheId);
            if (!detail) {
              try {
                const item = await omdbRequest(
                  request.key,
                  { i: movie.imdbID, plot: "short" },
                  signal,
                );
                if (item.Response === "False" || item.Error)
                  throw new Error(item.Error || "Нет данных");
                detail = { plot: item.Plot };
                if (!signal.aborted) cache.current.set(cacheId, detail);
              } catch (err) {
                if (signal.aborted) return;
                detail = { error: err.message || "Ошибка сети" };
              }
            }
            if (!signal.aborted)
              setDetails((current) => ({ ...current, [movie.imdbID]: detail }));
          }
        }
        await Promise.all(
          Array.from({ length: Math.min(3, results.length) }, worker),
        );
      } catch (err) {
        if (!signal.aborted) {
          setMovies([]);
          setTotal(0);
          setError(err.message || "Не удалось загрузить фильмы");
          setStatus("error");
        }
      } finally {
        if (!signal.aborted) busy.current = false;
      }
    }
    search();
    return () => {
      controller.abort();
      busy.current = false;
    };
  }, [request]);
  useEffect(() => {
    if (!autoSearch || query.trim().length < 3 || !apiKey.trim()) return;
    if (request?.query === query.trim() && request?.key === apiKey.trim())
      return;
    const timer = setTimeout(() => {
      if (busy.current) return;
      busy.current = true;
      setStatus("loading");
      setError(null);
      setMovies([]);
      setDetails({});
      setRequest({
        query: query.trim(),
        page: 1,
        key: apiKey.trim(),
        id: ++sequence.current,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [query, autoSearch, apiKey, request, status, details]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "lr6-search-history",
        JSON.stringify(history),
      );
    } catch {}
  }, [history]);

  const yearError = validateYears(yearFrom, yearTo);
  const visible = yearError ? movies : filterByYear(movies, yearFrom, yearTo);
  const pages = Math.min(100, Math.ceil(total / 10));
  const loading = status === "loading";
  const pending =
    loading ||
    (movies.length > 0 && Object.keys(details).length < movies.length);

  return (
    <main className="container">
      <h1>Поиск фильмов</h1>
      <section className="search-panel" aria-label="Настройки и поиск">
        <label htmlFor="api-key">API-ключ OMDb</label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          disabled={pending}
          onChange={(event) => {
            setApiKey(event.target.value);
            setError(null);
          }}
          placeholder="Ваш ключ OMDb"
          autoComplete="off"
        />
        <p className="hint">
          <a
            href="https://www.omdbapi.com/apikey.aspx"
            target="_blank"
            rel="noreferrer"
          >
            Получить ключ
          </a>
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            startSearch(query);
          }}
        >
          <label htmlFor="query">Название фильма</label>
          <div className="search-row">
            <input
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: Interstellar"
            />
            <button type="submit" disabled={pending}>
              {loading ? "Поиск…" : "Найти"}
            </button>
          </div>
        </form>
        <label className="check">
          <input
            type="checkbox"
            checked={autoSearch}
            onChange={(event) => setAutoSearch(event.target.checked)}
          />
          Автопоиск
        </label>
        <div className="year-fields">
          <div>
            <label htmlFor="year-from">Год от</label>
            <input
              id="year-from"
              type="number"
              value={yearFrom}
              onChange={(event) => setYearFrom(event.target.value)}
              placeholder="1900"
            />
          </div>
          <div>
            <label htmlFor="year-to">Год до</label>
            <input
              id="year-to"
              type="number"
              value={yearTo}
              onChange={(event) => setYearTo(event.target.value)}
              placeholder={String(new Date().getFullYear())}
            />
          </div>
        </div>
        <p className="hint">
          Диапазон года применяется к загруженной странице результатов.
        </p>
        {yearError && (
          <p className="error" role="alert">
            {yearError}
          </p>
        )}
        {history.length > 0 && (
          <div className="history">
            <p>Последние запросы</p>
            <div className="history-buttons">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => {
                    setQuery(item);
                    startSearch(item);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {error && (
        <p className="error" role="alert">
          Ошибка: {error}
        </p>
      )}
      {status === "idle" && (
        <p className="empty">Введите название фильма и нажмите «Найти».</p>
      )}
      {loading && (
        <p className="empty" role="status">
          <span className="spinner" /> Загрузка…
        </p>
      )}
      {status === "success" && (
        <section aria-label="Результаты поиска">
          <p className="result-count" role="status">
            Поиск: «{request.query}». Всего найдено: {total}. На странице
            показано: {visible.length}.
          </p>
          {visible.length === 0 ? (
            <p className="empty">
              {movies.length
                ? "На этой странице нет фильмов за выбранные годы."
                : "Ничего не найдено по вашему запросу."}
            </p>
          ) : (
            <div className="movie-list">
              {visible.map((movie) => (
                <MovieCard
                  key={movie.imdbID}
                  movie={movie}
                  details={details[movie.imdbID]}
                />
              ))}
            </div>
          )}
          {pages > 1 && (
            <nav className="pagination" aria-label="Страницы результатов">
              <button
                disabled={pending || request.page <= 1}
                onClick={() => startSearch(request.query, request.page - 1)}
              >
                Предыдущая
              </button>
              <span>
                Страница {request.page} из {pages}
              </span>
              <button
                disabled={pending || request.page >= pages}
                onClick={() => startSearch(request.query, request.page + 1)}
              >
                Следующая
              </button>
            </nav>
          )}
        </section>
      )}
    </main>
  );
}
