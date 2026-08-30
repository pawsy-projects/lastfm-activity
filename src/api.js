import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { api } from "./constants";

const tokenMod = findByProps("getToken");
const cacheDeezer = {};
const cacheAssets = {};

export function getCleanName(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val.username || val.apelido || "";
  return String(val);
}

export function fixTitle(str) {
  if (!str) return "?";
  const idx = str.indexOf(" (");
  if (idx > 0) return str.slice(0, idx).trim();
  return str.trim();
}

export function isBadCover(url) {
  if (!url || typeof url !== "string") return true;
  const str = url.toLowerCase();
  return (
    str.includes("2a96cbd8b46e442fc41c2b86b821562f") ||
    str.includes("default") ||
    str.includes("/star") ||
    str.includes("empty") ||
    str.includes("placeholder")
  );
}

export async function getUser(user) {
  const res = await fetch(`${api}/api/lastfm/user?username=${encodeURIComponent(user)}`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

export async function checkUser(user) {
  const str = String(user || "").trim();
  if (!str) throw new Error("Username obrigatorio");
  const res = await getUser(str);
  if (!res?.nome || res.status === 404) {
    throw new Error("user not found");
  }
  return res;
}

export async function searchDeezer(track, artist) {
  const k = (track + "|" + artist).toLowerCase();
  if (cacheDeezer[k]) return cacheDeezer[k];
  try {
    let res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(`track:"${track}" artist:"${artist}"`)}&limit=5`
    );
    let json = await res.json();
    let match = json?.data?.[0];
    if (!match) {
      res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&limit=5`
      );
      json = await res.json();
      match = json?.data?.[0];
    }
    const data = {
      cover: match?.album?.cover_xl || match?.album?.cover_big || match?.album?.cover_medium || null,
      duration: typeof match?.duration === "number" ? match.duration : null,
      link: match?.link || null,
    };
    cacheDeezer[k] = data;
    return data;
  } catch (e) {
    return { cover: null, duration: null, link: null };
  }
}

export async function uploadAsset(url) {
  if (!url) return null;
  if (cacheAssets[url]) return cacheAssets[url];
  try {
    const tok = tokenMod?.getToken?.();
    if (!tok) return null;
    const res = await fetch(
      `https://discord.com/api/v9/applications/${storage.applicationId}/external-assets`,
      {
        method: "POST",
        headers: { Authorization: tok, "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url] }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const path = json?.[0]?.external_asset_path || json?.external_asset_path;
    if (!path) return null;
    const mp = String(path).startsWith("mp:") ? path : "mp:" + path;
    cacheAssets[url] = mp;
    return mp;
  } catch (e) {
    return null;
  }
}
