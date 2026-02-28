const API = "https://api.jikan.moe/v4";

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const tpl = $("cardTpl");
const statusEl = $("status");

// 中文检索别名（常见动漫）
const ZH_ALIAS = {
  鬼灭: "Kimetsu no Yaiba",
  鬼灭之刃: "Kimetsu no Yaiba",
  咒术回战: "Jujutsu Kaisen",
  进击的巨人: "Shingeki no Kyojin",
  巨人: "Attack on Titan",
  火影: "Naruto",
  火影忍者: "Naruto",
  海贼王: "One Piece",
  航海王: "One Piece",
  死神: "Bleach",
  龙珠: "Dragon Ball",
  名侦探柯南: "Detective Conan",
  柯南: "Detective Conan",
  链锯人: "Chainsaw Man",
  间谍过家家: "Spy x Family",
  孤独摇滚: "Bocchi the Rock",
  芙莉莲: "Sousou no Frieren",
  葬送的芙莉莲: "Sousou no Frieren",
  药屋少女: "Kusuriya no Hitorigoto",
  我推的孩子: "Oshi no Ko",
  eva: "Neon Genesis Evangelion",
  新世纪福音战士: "Neon Genesis Evangelion",
};

function setStatus(msg) {
  statusEl.textContent = msg;
}

function safeText(s = "") {
  return String(s).replace(/\s+/g, " ").trim();
}

function truncate(s = "", n = 120) {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

function isChineseQuery(q = "") {
  return /[\u3400-\u9fff]/.test(q);
}

function animeMeta(a) {
  const year = a.year || a.aired?.prop?.from?.year || "?";
  const score = a.score ?? "-";
  const type = a.type || "未知类型";
  return `${type} · ${year} · ⭐ ${score}`;
}

function displayTitle(a) {
  return safeText(a.title_chinese || a.title_english || a.title || "未知动漫");
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

function dedupeByMalId(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const id = it?.mal_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

async function fetchAnimeByQuery(q, sfw = true, limit = 24) {
  const url = `${API}/anime?q=${encodeURIComponent(q)}&limit=${limit}&order_by=score&sort=desc${sfw ? "&sfw=true" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败 ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

function aliasFromChinese(q) {
  if (!isChineseQuery(q)) return "";

  if (ZH_ALIAS[q]) return ZH_ALIAS[q];

  const hit = Object.keys(ZH_ALIAS).find((k) => q.includes(k));
  return hit ? ZH_ALIAS[hit] : "";
}

function renderItems(items) {
  listEl.innerHTML = "";

  if (!items.length) {
    listEl.innerHTML = '<div class="card" style="padding:14px;">没找到结果。可试试：火影、海贼王、进击的巨人、鬼灭之刃。</div>';
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
    img.alt = displayTitle(a);
    title.textContent = displayTitle(a);
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
  setStatus(`已加载 ${items.length} 条（中文展示）`);
}

async function searchAnime(q) {
  const sfw = $("sfw").checked;
  setStatus(`搜索中：${q}`);

  let primary = await fetchAnimeByQuery(q, sfw, 24);
  let merged = primary;

  // 中文关键词时，自动补一次英文别名检索，提高命中率
  const alias = aliasFromChinese(q);
  if (alias && alias.toLowerCase() !== q.toLowerCase()) {
    const fallback = await fetchAnimeByQuery(alias, sfw, 24);
    merged = dedupeByMalId([...primary, ...fallback]);
    setStatus(`搜索完成：${merged.length} 条（已启用中文别名：${alias}）`);
  } else {
    setStatus(`搜索完成：${merged.length} 条`);
  }

  renderItems(merged);
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
