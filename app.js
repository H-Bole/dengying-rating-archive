(function () {
  "use strict";

  const FORMAL_TIERS = new Set(["天", "地", "玄", "黄", "破", "烂", "溜", "丢"]);
  const hasArchive = window.RATING_ARCHIVE && typeof window.RATING_ARCHIVE === "object";
  const archive = hasArchive ? window.RATING_ARCHIVE : {};
  const meta = archive.meta || {};
  const movies = Array.isArray(archive.movies)
    ? archive.movies.filter((movie) => movie && typeof movie === "object")
    : [];

  const elements = {
    search: document.querySelector("#search"),
    year: document.querySelector("#year-filter"),
    tier: document.querySelector("#tier-filter"),
    subtier: document.querySelector("#subtier-filter"),
    sort: document.querySelector("#sort-order"),
    clear: document.querySelector("#clear-filters"),
    grid: document.querySelector("#movie-grid"),
    empty: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyCopy: document.querySelector("#empty-copy"),
    count: document.querySelector("#result-count")
  };

  const text = (value, fallback = "") => value == null || value === "" ? fallback : String(value);
  const escapeHtml = (value) => text(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);

  function eventsOf(movie) {
    return Array.isArray(movie.events) ? movie.events : [];
  }

  function eventDate(event) {
    return text(event && (event.date || event.publishedAt || event.publishDate));
  }

  function latestEvent(movie) {
    return eventsOf(movie).reduce((latest, event) => {
      if (!latest) return event;
      return eventDate(event).localeCompare(eventDate(latest)) > 0 ? event : latest;
    }, null);
  }

  function currentOf(movie) {
    if (movie.currentRating && typeof movie.currentRating === "object") return movie.currentRating;
    const latest = latestEvent(movie) || {};
    if (movie.currentRating) return { ...latest, rawRating: movie.currentRating };
    return latest;
  }

  function tierOf(rating) {
    return text(rating && (rating.tier || rating.level || rating.standardRating));
  }

  function subtierOf(rating) {
    const value = text(rating && (rating.subtier || rating.subTier || rating.grade));
    return ({ 上等: "上", 上: "上", 中等: "中", 中: "中", 下等: "下", 下: "下" })[value] || value;
  }

  function ratingLabel(rating) {
    if (!rating) return "未标注";
    const raw = text(rating.rawRating || rating.rating || rating.label || rating.name);
    if (raw) return raw;
    const tier = tierOf(rating);
    const sub = subtierOf(rating);
    return `${tier}${sub}` || "未标注";
  }

  function isFormal(movie) {
    const current = currentOf(movie);
    const type = text(current && (current.type || current.ratingType)).toLowerCase();
    if (type === "formal" || type === "official") return true;
    if (type === "special") return false;
    return FORMAL_TIERS.has(tierOf(current)) || FORMAL_TIERS.has(ratingLabel(current).charAt(0));
  }

  function aliasesOf(movie) {
    if (Array.isArray(movie.aliases)) return movie.aliases.filter(Boolean).map(String);
    return movie.aliases ? [String(movie.aliases)] : [];
  }

  function tmdbOf(movie) {
    return movie.tmdb && typeof movie.tmdb === "object" ? movie.tmdb : {};
  }

  function titleOf(movie) {
    return text(movie.title || movie.name || movie.canonicalTitle, "未命名电影");
  }

  function searchable(movie) {
    const tmdb = tmdbOf(movie);
    return [titleOf(movie), ...aliasesOf(movie), tmdb.titleZh, tmdb.originalTitle]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-CN");
  }

  function statusOf(event) {
    return text(event && (event.status || event.ratingStatus));
  }

  function excerptOf(event) {
    return text(event && (event.excerpt || event.quote || event.summary));
  }

  function sourceOf(event) {
    const source = event && event.source;
    if (source && typeof source === "object") {
      return {
        url: text(source.url || source.href, "https://space.bilibili.com/4140446/dynamic"),
        label: text(source.label || source.locator || source.location, "查看来源")
      };
    }
    return {
      url: text(event && (event.sourceUrl || event.url), "https://space.bilibili.com/4140446/dynamic"),
      label: text(source || (event && (event.sourceLocation || event.locator)), "动态流定位")
    };
  }

  function safeSourceUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function renderSource(event) {
    const source = sourceOf(event);
    const url = safeSourceUrl(source.url);
    if (url) {
      return `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`;
    }
    return source.label ? `<span class="source-text">${escapeHtml(source.label)}</span>` : "";
  }

  function renderEvent(event) {
    const date = eventDate(event) || "日期未标注";
    const status = statusOf(event);
    const excerpt = excerptOf(event);
    return `
      <li>
        <div class="timeline__top">
          <time datetime="${escapeHtml(eventDate(event))}">评分于 ${escapeHtml(date)}</time>
          <strong>${escapeHtml(ratingLabel(event))}</strong>
          ${status ? `<span class="status-tag">${escapeHtml(status)}</span>` : ""}
        </div>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}
        ${renderSource(event)}
      </li>`;
  }

  function renderMovie(movie) {
    const events = eventsOf(movie).slice().sort((a, b) => eventDate(b).localeCompare(eventDate(a)));
    const current = currentOf(movie);
    const lead = excerptOf(current);
    const date = eventDate(current) || "日期未标注";
    const status = statusOf(current);
    const aliases = aliasesOf(movie);
    const tmdb = tmdbOf(movie);
    const specialClass = isFormal(movie) ? "" : " rating-stamp--special";
    const tier = isFormal(movie) ? tierOf(current) || ratingLabel(current).charAt(0) : "special";
    const titleZh = text(tmdb.titleZh);
    const originalTitle = text(tmdb.originalTitle);
    const alternateTitle = titleZh && titleZh !== titleOf(movie) ? titleZh : "";
    const releaseDate = text(tmdb.releaseDate);
    const cast = Array.isArray(tmdb.cast) ? tmdb.cast.filter(Boolean) : [];

    return `
      <article class="movie-card" data-tier="${escapeHtml(tier)}">
        <div class="movie-card__date" aria-hidden="true">
          <strong>${escapeHtml(date.slice(5).replace("-", "."))}</strong>
          <span>${escapeHtml(date.slice(0, 4))}</span>
        </div>
        <header class="movie-card__head">
          <div>
            <h3>${escapeHtml(titleOf(movie))}</h3>
            ${aliases.length ? `<p class="aliases">又名：${aliases.map(escapeHtml).join(" / ")}</p>` : ""}
          </div>
          <span class="rating-stamp${specialClass}" aria-label="当前评级：${escapeHtml(ratingLabel(current))}">${escapeHtml(ratingLabel(current))}</span>
        </header>
        <div class="movie-profile">
          ${tmdb.poster ? `<img class="movie-profile__poster" src="${escapeHtml(tmdb.poster)}" alt="${escapeHtml(titleZh || titleOf(movie))}海报" loading="lazy" decoding="async">` : ""}
          <div class="movie-profile__copy">
            ${(alternateTitle || (originalTitle && originalTitle !== titleZh)) ? `<p class="movie-profile__titles">${alternateTitle ? `<strong>${escapeHtml(alternateTitle)}</strong>` : ""}${originalTitle && originalTitle !== titleZh ? `<span>${escapeHtml(originalTitle)}</span>` : ""}</p>` : ""}
            <dl class="movie-facts">
              ${releaseDate ? `<div><dt>上映日期</dt><dd><time datetime="${escapeHtml(releaseDate)}">${escapeHtml(releaseDate)}</time></dd></div>` : ""}
              ${tmdb.director ? `<div><dt>导演</dt><dd>${escapeHtml(tmdb.director)}</dd></div>` : ""}
              ${cast.length ? `<div><dt>主演</dt><dd>${cast.map(escapeHtml).join(" / ")}</dd></div>` : ""}
              ${tmdb.runtime ? `<div><dt>片长</dt><dd>${escapeHtml(tmdb.runtime)} 分钟</dd></div>` : ""}
            </dl>
            ${tmdb.overview ? `<p class="movie-overview">${escapeHtml(tmdb.overview)}</p>` : ""}
          </div>
        </div>
        <div class="movie-card__body">
          ${lead ? `<p class="event-lead">“${escapeHtml(lead)}”</p>` : ""}
          <p class="card-meta">
            <span>评分：<time datetime="${escapeHtml(eventDate(current))}">${escapeHtml(date)}</time></span>
            ${status ? `<span class="status-tag">${escapeHtml(status)}</span>` : ""}
            <span>${isFormal(movie) ? "正式评级" : "特殊评级"}</span>
          </p>
          <details class="history">
            <summary><span>评分来源与修订记录</span><b>${events.length}</b></summary>
            <ol class="timeline">${events.length ? events.map(renderEvent).join("") : "<li><p>暂无可展示的评级事件。</p></li>"}</ol>
          </details>
        </div>
      </article>`;
  }

  function movieDate(movie) {
    return eventDate(currentOf(movie));
  }

  function yearsOf(movie) {
    const year = movieDate(movie).slice(0, 4);
    return /^\d{4}$/.test(year) ? [year] : [];
  }

  function renderTimeline(moviesToRender) {
    const groups = new Map();
    moviesToRender.forEach((movie) => {
      const year = movieDate(movie).slice(0, 4) || "日期未标注";
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(movie);
    });
    return [...groups].map(([year, group]) => `
      <section class="timeline-year" aria-labelledby="year-${escapeHtml(year)}">
        <header class="timeline-year__head">
          <p>RATING YEAR</p>
          <h2 id="year-${escapeHtml(year)}">${escapeHtml(year)}</h2>
          <span>${group.length} 部</span>
        </header>
        <div class="timeline-year__entries">${group.map(renderMovie).join("")}</div>
      </section>`).join("");
  }

  function render() {
    const query = elements.search.value.trim().toLocaleLowerCase("zh-CN");
    const year = elements.year.value;
    const tier = elements.tier.value;
    const subtier = elements.subtier.value;
    const direction = elements.sort.value === "earliest" ? 1 : -1;
    const visible = movies
      .filter((movie) => !query || searchable(movie).includes(query))
      .filter((movie) => !year || yearsOf(movie).includes(year))
      .filter((movie) => {
        if (!tier) return true;
        if (tier === "special") return !isFormal(movie);
        const current = currentOf(movie);
        return isFormal(movie) && (tierOf(current) || ratingLabel(current).charAt(0)) === tier;
      })
      .filter((movie) => {
        if (!subtier) return true;
        const value = subtierOf(currentOf(movie));
        return subtier === "none" ? !value : value === subtier.charAt(0);
      })
      .sort((a, b) => direction * movieDate(a).localeCompare(movieDate(b)));

    elements.grid.innerHTML = renderTimeline(visible);
    elements.empty.hidden = visible.length > 0;
    elements.count.textContent = `显示 ${visible.length} / ${movies.length} 部电影`;

    if (!movies.length && !hasArchive) {
      elements.emptyTitle.textContent = "档案数据尚未装载";
      elements.emptyCopy.textContent = "请确认 ratings.js 与本页面位于同一目录，且包含可用的电影记录。";
    } else if (!movies.length) {
      elements.emptyTitle.textContent = "档案暂无收录数据";
      elements.emptyCopy.textContent = text(meta.completeness, "采集与人工复核完成后，电影记录会显示在这里。");
    } else {
      elements.emptyTitle.textContent = "没有匹配的电影";
      elements.emptyCopy.textContent = "换个片名，或清空筛选条件再试。";
    }
  }

  function setStatistics() {
    const auditCount = Array.isArray(archive.audit)
      ? archive.audit.length
      : Number(meta.reviewedCards || meta.reviewedCount || meta.cardCount || meta.totalCards) || "—";
    document.querySelector("#stat-reviewed").textContent = auditCount;
    document.querySelector("#stat-movies").textContent = movies.length;
    document.querySelector("#stat-cutoff").textContent = text(meta.collectedAt || meta.collectionDate || meta.cutoffDate, "—");
    document.querySelector("#stat-earliest").textContent = text(meta.earliestVisibleDate || meta.earliestDate, "—");
    if (meta.completeness || meta.scopeNote) {
      document.querySelector("#scope-note").textContent = text(meta.completeness || meta.scopeNote);
    }
  }

  function fillYears() {
    const years = [...new Set(movies.flatMap(yearsOf))].sort((a, b) => b.localeCompare(a));
    elements.year.insertAdjacentHTML("beforeend", years.map((year) => `<option value="${year}">${year} 年</option>`).join(""));
  }

  elements.search.addEventListener("input", render);
  [elements.year, elements.tier, elements.subtier, elements.sort].forEach((element) => element.addEventListener("change", render));
  elements.tier.addEventListener("change", () => {
    const special = elements.tier.value === "special";
    elements.subtier.disabled = special;
    if (special) elements.subtier.value = "";
    render();
  });
  elements.clear.addEventListener("click", () => {
    elements.search.value = "";
    elements.year.value = "";
    elements.tier.value = "";
    elements.subtier.value = "";
    elements.subtier.disabled = false;
    elements.sort.value = "latest";
    render();
    elements.search.focus();
  });

  setStatistics();
  fillYears();
  render();
})();
