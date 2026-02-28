const API = "https://api.jikan.moe/v4";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const tpl = $("cardTpl");
const statusEl = $("status");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function safeText(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

function truncate(s = "", n = 120) {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

function animeMeta(a) {
  const year = a.year || a.aired?.prop?.from?.year || "?";
  const score = a.score ?? "-";
  const type = a.type || "Unknown";
  return `${type} · ${year} · ⭐ ${score}`;
}

function trailerEmbedUrl(a) {
  const yt = a?.trailer?.youtube_id;
  if (!yt) return "";
  return `https://www.youtube.com/embed/${yt}`;
}

function streamingLinks(a) {
  return Array.isArray(a?.streaming) ? a.streaming.filter((x) => x?.url) : [];
}

function makeStreamLinksHtml(links) {
  if (!links.length) return "";
  return links
    .slice(0, 4)
    .map((x) => `<a class="stream-link" href="${x.url}" target="_blank" rel="noreferrer">${safeText(x.name || "播放源")}</a>`)
    .join("");
}

function renderItems(items) {
  listEl.innerHTML = "";

  if (!items.length) {
    listEl.innerHTML = '<div class="card" style="padding:14px;">没找到结果，换个关键词试试（例如英文名：Naruto / Attack on Titan）。</div>';
    return;
  }

  for (const a of items) {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".cover");
    const title = node.querySelector(".title");
    const meta = node.querySelector(".meta");
    const desc = node.querySelector(".desc");
    const detail = node.querySelector(".btn");
    const playBtn = node.querySelector(".playBtn");
    const playerWrap = node.querySelector(".player-wrap");
    const iframe = node.querySelector(".player");

    img.src = a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || "";
    img.alt = safeText(a.title || "anime");
    title.textContent = safeText(a.title || a.title_english || "Unknown");
    meta.textContent = animeMeta(a);
    desc.textContent = truncate(safeText(a.synopsis || "暂无简介"), 120);
    detail.href = a.url;
    detail.textContent = "MAL 条目";

    const embed = trailerEmbedUrl(a);
    const streams = streamingLinks(a);

    const extra = document.createElement("div");
    extra.className = "streams";
    if (streams.length) {
      extra.innerHTML = `<span class="streams-title">可用外链：</span>${makeStreamLinksHtml(streams)}`;
    } else {
      extra.innerHTML = '<span class="streams-empty">未返回外链播放源</span>';
    }
    node.querySelector(".content").appendChild(extra);

    if (!embed) {
      playBtn.disabled = true;
      playBtn.textContent = "暂无可嵌入预告";
    } else {
      playBtn.addEventListener("click", () => {
        const isOpen = !playerWrap.classList.contains("hidden");
        if (isOpen) {
          iframe.src = "";
          playerWrap.classList.add("hidden");
          playBtn.textContent = "在线播放预告";
        } else {
          iframe.src = embed;
          playerWrap.classList.remove("hidden");
          playBtn.textContent = "收起预告";
        }
      });
    }

    listEl.appendChild(node);
  }
}

async function loadTop() {
  const sfw = $("sfw").checked;
  setStatus("正在加载今日热门...");
  const url = `${API}/top/anime?limit=24${sfw ? "&sfw=true" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  const json = await res.json();

  const items = json.data || [];
  renderItems(items);
  setStatus(`已加载 ${items.length} 条（含预告/外链信息）`);
}

async function searchAnime(q) {
  const sfw = $("sfw").checked;
  setStatus(`搜索中：${q}`);
  const url = `${API}/anime?q=${encodeURIComponent(q)}&limit=24&order_by=score&sort=desc${sfw ? "&sfw=true" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  const json = await res.json();

  const items = json.data || [];
  renderItems(items);
  setStatus(`搜索完成：${items.length} 条`);
}

$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("keyword").value.trim();
  if (!q) return loadTop();
  try {
    await searchAnime(q);
  } catch (err) {
    console.error(err);
    setStatus(`搜索失败：${err.message}`);
  }
});

$("loadTopBtn").addEventListener("click", async () => {
  try {
    await loadTop();
  } catch (err) {
    console.error(err);
    setStatus(`加载失败：${err.message}`);
  }
});

loadTop().catch((err) => {
  console.error(err);
  setStatus(`初始化失败：${err.message}`);
});
