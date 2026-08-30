import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { getUser, fixTitle, searchDeezer, isBadCover, uploadAsset } from "./api";
import { t } from "./i18n";

const flux = findByProps("dispatch", "subscribe");

let timer = null;
let lastKey = "";
let startTime = null;
let trackLength = 210;

export function updatePresence(act) {
  if (!flux?.dispatch) return;
  flux.dispatch({
    type: "LOCAL_ACTIVITY_UPDATE",
    activity: act,
    pid: 1608,
    socketId: "pawsy@lastfm",
  });
}

export function clearPresence() {
  updatePresence(null);
  lastKey = "";
  startTime = null;
  trackLength = 210;
}

export async function tick(force) {
  const user = String(storage.username || "").trim();
  if (!user) {
    if (force) showToast(t("noUserErr"), getAssetIDByName("CircleXIcon"));
    clearPresence();
    return;
  }

  try {
    const data = await getUser(user);
    const pres = data?.presença;

    if (!pres?.escutando || !pres.musica) {
      if (lastKey !== "" || force) {
        clearPresence();
        if (force) showToast(t("nothing"), getAssetIDByName("ic_info"));
      }
      return;
    }

    const raw = pres.musica.nome || "?";
    const song = fixTitle(raw);
    const artist = pres.musica.artista || "?";
    const plays = pres.musica.vezes_tocada;
    const rawCover = typeof pres.musica.capa === "string" ? pres.musica.capa : null;
    const profile = (data.perfil && String(data.perfil).startsWith("http") ? data.perfil : null) || `https://www.last.fm/pt/user/${encodeURIComponent(user)}`;

    const k = `${song}|${artist}`;
    const isNew = k !== lastKey;

    if (isNew || !startTime) {
      startTime = Date.now();
    }

    const dz = await searchDeezer(song, artist);
    if (dz.duration && dz.duration > 0) {
      trackLength = dz.duration;
    } else if (isNew) {
      trackLength = 210;
    }

    let imgUrl = rawCover;
    if (isBadCover(imgUrl)) imgUrl = dz.cover || imgUrl;
    const assetId = await uploadAsset(imgUrl);

    const start = startTime;
    const end = start + trackLength * 1000;
    const sub = plays != null ? `${t("by")}${artist} • ${plays}` : `${t("by")}${artist}`;

    const act = {
      name: "Last.fm",
      application_id: String(storage.applicationId),
      type: 2,
      details: song,
      state: sub,
      timestamps: { start, end },
      assets: {},
      flags: 0,
    };

    if (assetId) {
      act.assets.large_image = assetId;
      act.assets.large_text = artist;
    }

    if (storage.showProfileButton && profile) {
      act.buttons = [t("profileBtn")];
      act.metadata = { button_urls: [profile] };
    }

    if (isNew) {
      clearPresence();
      startTime = start;
      lastKey = "";
      setTimeout(() => {
        updatePresence(act);
        lastKey = k;
      }, 150);
    } else {
      updatePresence(act);
      lastKey = k;
    }

    if ((isNew && storage.toastOnChange) || (force && !isNew)) {
      showToast(`${artist} - ${song}`, getAssetIDByName("CheckIcon"));
    }
  } catch (e) {
    if (force) showToast(`${t("err")}${e?.message || e}`, getAssetIDByName("CircleXIcon"));
  }
}

export function resetTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  const user = String(storage.username || "").trim();
  if (!user) return;
  const sec = Math.max(5, Number(storage.intervalSec) || 8);
  timer = setInterval(() => tick(false), sec * 1000);
}

export function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}