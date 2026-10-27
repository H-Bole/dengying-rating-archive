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
    release: document.querySelector("#timeline-release"),
    rating: document.querySelector("#timeline-rating"),
    search: document.querySelector("#search"),
    year: document.querySelector("#year-filter"),
    yearLabel: document.querySelector("#year-label"),
    tier: document.querySelector("#tier-filter"),
    subtier: document.querySelector("#subtier-filter"),
    sort: document.querySelector("#sort-order"),
    sortLabel: document.querySelector("#sort-label"),
    semantics: document.querySelector("#filter-semantics"),
    clear: document.querySelector("#clear-filters"),
    grid: document.querySelector("#movie-grid"),
    empty: document.querySelector("#empty-state"),
    emptyTitle: document.querySelector("#empty-title"),
    emptyCopy: document.querySelector("#empty-copy"),
    count: document.querySelector("#result-count"),
    moreFilters: document.querySelector("#more-filters"),
    moreFilterCount: document.querySelector("#more-filter-count"),
    activeFilters: document.querySelector("#active-filters")
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

  function releaseDateOf(movie) {
    const value = text(tmdbOf(movie).releaseDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
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

  function publishedAtOf(event) {
    const value = text(event && event.publishedAt);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value)) ? value : "";
  }

  function renderEvent(event, currentEvent) {
    const date = eventDate(event) || "日期未标注";
    const status = statusOf(event);
    const excerpt = excerptOf(event);
    const publishedAt = publishedAtOf(event);
    const isCurrent = currentEvent !== null && event === currentEvent;
    return `
      <li${isCurrent ? ' class="timeline__current"' : ""}>
        <div class="timeline__top">
          <time datetime="${escapeHtml(publishedAt || eventDate(event))}">评分于 ${escapeHtml(date)}${publishedAt ? ` ${escapeHtml(publishedAt.slice(11, 16))}` : ""}</time>
          <strong>${escapeHtml(ratingLabel(event))}</strong>
          ${isCurrent ? '<span class="status-tag status-tag--current">当前</span>' : ""}
          ${status ? `<span class="status-tag">${escapeHtml(status)}</span>` : ""}
        </div>
        ${excerpt ? `<p>${escapeHtml(excerpt)}</p>` : ""}
        ${renderSource(event)}
      </li>`;
  }

  function renderMovie(movie) {
    const current = currentOf(movie);
    const matches = eventsOf(movie).filter((event) => eventDate(event) === eventDate(current)
      && ratingLabel(event) === ratingLabel(current) && statusOf(event) === statusOf(current));
    const currentEvent = matches.length === 1 ? matches[0] : null;
    const days = new Map();
    eventsOf(movie).forEach((event) => {
      const day = eventDate(event).slice(0, 10);
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(event);
    });
    const events = [...days].sort(([a], [b]) => b.localeCompare(a)).flatMap(([, group]) => {
      const hasExactTimes = group.every((event) => publishedAtOf(event));
      return group.sort((a, b) => Number(b === currentEvent) - Number(a === currentEvent)
        || (hasExactTimes ? Date.parse(publishedAtOf(b)) - Date.parse(publishedAtOf(a)) : 0));
    });
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
    const releaseDate = releaseDateOf(movie);
    const releaseDateMarkup = `<span class="card-date${elements.release.checked ? " card-date--primary" : ""}">上映日期：${releaseDate ? `<time datetime="${escapeHtml(releaseDate)}">${escapeHtml(releaseDate)}</time>` : "未收录"}</span>`;
    const ratingDateMarkup = `<span class="card-date${elements.release.checked ? "" : " card-date--primary"}">评分日期：<time datetime="${escapeHtml(eventDate(current))}">${escapeHtml(date)}</time></span>`;
    const cast = Array.isArray(tmdb.cast) ? tmdb.cast.filter(Boolean) : [];
    const hasInfo = alternateTitle || (originalTitle && originalTitle !== titleZh)
      || releaseDate || tmdb.director || cast.length || tmdb.runtime || tmdb.overview;

    return `
      <article class="movie-card" data-tier="${escapeHtml(tier)}" data-movie-key="${escapeHtml(titleOf(movie))}">
        <header class="movie-card__head${tmdb.poster ? "" : " movie-card__head--no-poster"}">
          ${tmdb.poster ? `<img class="movie-profile__poster" src="${escapeHtml(tmdb.poster)}" alt="${escapeHtml(titleZh || titleOf(movie))}海报" loading="lazy" decoding="async">` : ""}
          <div class="movie-card__heading">
            <h3>${escapeHtml(titleOf(movie))}</h3>
            ${aliases.length ? `<p class="aliases">又名：${aliases.map(escapeHtml).join(" / ")}</p>` : ""}
            <div class="current-rating">
              <span class="rating-caption">当前评级</span>
              <span class="rating-stamp${specialClass}">${escapeHtml(ratingLabel(current))}</span>
              ${status ? `<span class="status-tag">${escapeHtml(status)}</span>` : ""}
            </div>
            <div class="card-dates">${elements.release.checked ? releaseDateMarkup + ratingDateMarkup : ratingDateMarkup + releaseDateMarkup}</div>
            <p class="card-meta">
              <span>${isFormal(movie) ? "正式评级" : "特殊评级"}</span>
            </p>
          </div>
        </header>
        <div class="movie-card__body">
          ${lead ? `<p class="event-lead">“${escapeHtml(lead)}”</p>` : ""}
          <details class="history">
            <summary><span>评级记录与来源 · ${events.length}条</span>${events.some((event) => statusOf(event).includes("调级")) ? '<span class="history__hint">含调级</span>' : ""}</summary>
            <p class="history-note">最新记录在前，含当前评级及历史记录。</p>
            <ol class="timeline">${events.length ? events.map((event) => renderEvent(event, currentEvent)).join("") : "<li><p>暂无可展示的评级事件。</p></li>"}</ol>
          </details>
          ${hasInfo ? `<details class="movie-info">
            <summary><span>电影资料</span><span class="disclosure-hint">上映 · 主创 · 简介</span></summary>
            <div class="movie-profile">
              ${(alternateTitle || (originalTitle && originalTitle !== titleZh)) ? `<p class="movie-profile__titles">${alternateTitle ? `<strong>${escapeHtml(alternateTitle)}</strong>` : ""}${originalTitle && originalTitle !== titleZh ? `<span>${escapeHtml(originalTitle)}</span>` : ""}</p>` : ""}
              <dl class="movie-facts">
                ${releaseDate ? `<div><dt>上映日期</dt><dd><time datetime="${escapeHtml(releaseDate)}">${escapeHtml(releaseDate)}</time></dd></div>` : ""}
                ${tmdb.director ? `<div><dt>导演</dt><dd>${escapeHtml(tmdb.director)}</dd></div>` : ""}
                ${cast.length ? `<div><dt>主演</dt><dd>${cast.map(escapeHtml).join(" / ")}</dd></div>` : ""}
                ${tmdb.runtime ? `<div><dt>片长</dt><dd>${escapeHtml(tmdb.runtime)} 分钟</dd></div>` : ""}
              </dl>
              ${tmdb.overview ? `<p class="movie-overview">${escapeHtml(tmdb.overview)}</p>` : ""}
            </div>
          </details>` : ""}
        </div>
      </article>`;
  }

  function movieDate(movie) {
    return elements.release.checked ? releaseDateOf(movie) : eventDate(currentOf(movie));
  }

  function yearsOf(movie) {
    const year = movieDate(movie).slice(0, 4);
    return /^\d{4}$/.test(year) ? [year] : [];
  }

  function renderTimeline(moviesToRender) {
    const groups = new Map();
    moviesToRender.forEach((movie) => {
      const year = yearsOf(movie)[0] || "";
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(movie);
    });
    return [...groups].map(([year, group]) => `
      <section class="timeline-year" aria-labelledby="year-${escapeHtml(year || "unknown")}">
        <header class="timeline-year__head">
          <p>${elements.release.checked ? (year ? "RELEASE YEAR" : "RELEASE DATE UNKNOWN") : (year ? "RATING YEAR" : "RATING DATE UNKNOWN")}</p>
          <h2 id="year-${escapeHtml(year || "unknown")}">${escapeHtml(year || (elements.release.checked ? "上映日期未收录" : "评分日期未标注"))}</h2>
          <span>${group.length} 部</span>
        </header>
        <div class="timeline-year__entries">${group.map(renderMovie).join("")}</div>
      </section>`).join("");
  }

  function render() {
    const disclosureState = new Map([...elements.grid.querySelectorAll(".movie-card")].map((card) => [
      card.dataset.movieKey,
      { history: card.querySelector(".history").open, info: Boolean(card.querySelector(".movie-info")?.open) }
    ]));
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
      .sort((a, b) => {
        const aDate = movieDate(a);
        const bDate = movieDate(b);
        return Number(!aDate) - Number(!bDate) || direction * aDate.localeCompare(bDate);
      });

    elements.grid.innerHTML = renderTimeline(visible);
    elements.grid.querySelectorAll(".movie-card").forEach((card) => {
      const state = disclosureState.get(card.dataset.movieKey);
      if (!state) return;
      card.querySelector(".history").open = state.history;
      const info = card.querySelector(".movie-info");
      if (info) info.open = state.info;
    });
    elements.empty.hidden = visible.length > 0;
    elements.count.textContent = `按${elements.release.checked ? "上映" : "评分"}时间显示 ${visible.length} / ${movies.length} 部`;
    const filters = [];
    if (query) filters.push(`片名：${elements.search.value.trim()}`);
    if (year) filters.push(`${elements.release.checked ? "上映" : "评分"}年份：${year}`);
    if (tier) filters.push(`评级：${elements.tier.selectedOptions[0].textContent}`);
    if (subtier) filters.push(`细分：${elements.subtier.selectedOptions[0].textContent}`);
    if (elements.sort.value !== "latest") filters.push(`排序：${elements.sort.selectedOptions[0].textContent}`);
    elements.activeFilters.textContent = filters.length ? `当前条件：${filters.join("；")}` : "未限定筛选条件";
    const extraCount = Number(Boolean(year)) + Number(Boolean(subtier)) + Number(elements.sort.value !== "latest");
    elements.moreFilterCount.textContent = extraCount ? `${extraCount} 项已选` : "";

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
    elements.year.innerHTML = '<option value="">全部年份</option>' + years.map((year) => `<option value="${year}">${year} 年</option>`).join("");
  }

  function updateTimelineSemantics() {
    const release = elements.release.checked;
    elements.yearLabel.textContent = release ? "上映年份" : "评分年份";
    elements.sortLabel.textContent = release ? "上映时间顺序" : "评分时间顺序";
    elements.grid.setAttribute("aria-label", release ? "按上映日期排列的电影评级时间线" : "按当前评分日期排列的电影评级时间线");
    elements.semantics.textContent = `年份筛选、分组与排序均按${release ? "上映日期" : "当前评分日期"}；评级筛选仅匹配当前评级，历史记录不参与匹配。`;
  }

  [elements.release, elements.rating].forEach((element) => element.addEventListener("change", () => {
    elements.year.value = "";
    fillYears();
    updateTimelineSemantics();
    render();
  }));
  elements.search.addEventListener("input", render);
  [elements.year, elements.subtier, elements.sort].forEach((element) => element.addEventListener("change", render));
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

  elements.release.checked = true;
  elements.rating.checked = false;
  setStatistics();
  fillYears();
  updateTimelineSemantics();
  elements.moreFilters.open = window.matchMedia("(min-width: 981px)").matches;
  render();
})();
