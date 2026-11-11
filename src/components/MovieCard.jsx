import { useState } from "react";

export function MovieCard({ movie, details }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const hasPoster = movie.Poster && movie.Poster !== "N/A" && !posterFailed;
  return (
    <article className="movie-card">
      {hasPoster ? (
        <img
          className="poster"
          src={movie.Poster}
          alt={`Постер: ${movie.Title}`}
          loading="lazy"
          onError={() => setPosterFailed(true)}
        />
      ) : (
        <div
          className="poster placeholder"
          role="img"
          aria-label="Постер отсутствует"
        >
          Нет постера
        </div>
      )}
      <div className="movie-content">
        <h2>{movie.Title}</h2>
        <p className="year">Год: {movie.Year}</p>
        {!details ? (
          <p className="hint" role="status">
            <span className="spinner" /> Загрузка описания…
          </p>
        ) : details.error ? (
          <p className="hint">Описание недоступно: {details.error}</p>
        ) : (
          <p className="plot">
            {details.plot && details.plot !== "N/A"
              ? details.plot
              : "Описание отсутствует."}
          </p>
        )}
      </div>
    </article>
  );
}
