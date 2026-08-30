import { findByProps } from "@vendetta/metro";
import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } = "@vendetta/ui/components";
import { registerCommand } from "@vendetta/commands";

const api = "https://pawsy-rapositosas-projects-99beaca1.vercel.app";
const lastfmImg = "https://www.last.fm/static/images/lastfm_avatar_twitter.66cd2c48e897.png";

const dict = {
  pt: {
    synced: "sincronizado!",
    active: "ativo!",
    noUserErr: "Abra a configuração para setar seu username.",
    nothing: "Tocando nada",
    userNotFound: "Usuário não achado",
    userReq: "Usuário é necessário",
    err: "Erro: ",
    noNav: "Não disponível",
    noFlux: "flux.dispatcher não encontrado",

    cmdDesc: "Forçar sincronização do Last.fm",
    secAuth: "LOGAR:",
    secOpts: "OPÇÕES:",
    secAct: "OPÇÕES DE ATIVIDADE:",
    secCredits: "CRÉDITOS:",

    login: "Login & conta",
    linked: "A conta vinculada que será registrada nas atividades!",
    noUser: "Nenhum usuário logado.",
    saveBtn: "Validar e salvar a conta!",
    syncData: "A conta será sincronizada, certifique se escreveu seu username corretamente!",
    connected: "Conectado como: @",

    userField: "Nome da sua conta:",
    userPlace: "Digite aqui...",

    intervalField: "Tempo de sincronização (segundos):",
    toastToggle: "Notificar troca de música",
    toastSub: "Exibe um pequeno pop-up quando a música for atualizada.",
    btnToggle: "Botão de perfil",
    btnSub: "Acessar seu perfil na atividade (beta).",
    forceBtn: "Forçar sincronização",
    forceSub: "Atualize agora ignorando o intervalo.",

    subTitle: "Mostre para todos o que você está ouvindo na Last.fm de uma forma fácil e simples!",
    actSettings: "Configurações da atividade",
    actSettingsSub: "Personalize o tempo de intervalo, pop-up e botão.",
    profileBtn: "Perfil Last.fm",
    by: "de "
  }
};

function t(k) {
  const lang = storage.lang || "pt";
  return dict[lang]?.[k] || dict["pt"]?.[k] || k;
}

// api
const flux = findByProps("dispatch", "subscribe");
const tokenMod = findByProps("getToken");

const cacheDeezer = {};
const cacheAssets = {};
let timer = null;
let lastKey = "";
let startTime = null;
let trackLength = 210;
let loading = false;

function getCleanName(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") return val.username || val.apelido || "";
  return String(val);
}

function fixTitle(str) {
  if (!str) return "?";
  const idx = str.indexOf(" (");
  if (idx > 0) return str.slice(0, idx).trim();
  return str.trim();
}

function isBadCover(url) {
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

async function getUser(user) {
  const res = await fetch(`${api}/api/lastfm/user?username=${encodeURIComponent(user)}`);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function checkUser(user) {
  const str = String(user || "").trim();
  if (!str) throw new Error("Username obrigatorio");
  const res = await getUser(str);
  if (!res?.nome || res.status === 404) {
    throw new Error("Usuario nao encontrado");
  }
  return res;
}

async function searchDeezer(track, artist) {
  const k = (track + "|" + artist).toLowerCase();
  if (cacheDeezer[k]) return cacheDeezer[k];
  try {
    let res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`track:"${track}" artist:"${artist}"`)}&limit=5`);
    let json = await res.json();
    let match = json?.data?.[0];
    if (!match) {
      res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&limit=5`);
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

async function uploadAsset(url) {
  if (!url) return null;
  if (cacheAssets[url]) return cacheAssets[url];
  try {
    const tok = tokenMod?.getToken?.();
    if (!tok) return null;
    const res = await fetch(`https://discord.com/api/v9/applications/${storage.applicationId}/external-assets`, {
      method: "POST",
      headers: { Authorization: tok, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: [url] }),
    });
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

function updatePresence(act) {
  if (!flux?.dispatch) return;
  flux.dispatch({
    type: "LOCAL_ACTIVITY_UPDATE",
    activity: act,
    pid: 1608,
    socketId: "pawsy@lastfm",
  });
}

function clearPresence() {
  updatePresence(null);
  lastKey = "";
  startTime = null;
  trackLength = 210;
}

async function tick(force) {
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

function resetTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  const user = String(storage.username || "").trim();
  if (!user) return;
  const sec = Math.max(5, Number(storage.intervalSec) || 8);
  timer = setInterval(() => tick(false), sec * 1000);
}

function LoginScreen() {
  useProxy(storage);
  const [msg, setMsg] = React.useState("");
  const [account, setAccount] = React.useState(null);

  const loadData = React.useCallback(async () => {
    const u = String(storage.username || "").trim();
    if (!u) {
      setAccount(null);
      return;
    }
    try {
      const res = await getUser(u);
      setAccount(res);
    } catch (e) {
      setAccount(null);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const onSave = async () => {
    const u = String(storage.username || "").trim();
    if (!u) {
      setMsg("Digite um usuario.");
      showToast(t("userReq"), getAssetIDByName("CircleXIcon"));
      setAccount(null);
      clearPresence();
      resetTimer();
      return;
    }
    if (loading) return;
    loading = true;
    setMsg("Validando...");
    try {
      const data = await checkUser(u);
      storage.username = u;
      setAccount(data);
      setMsg(`${t("connected")}${u}`);
      showToast(`Last.fm: ${u}`, getAssetIDByName("CheckIcon"));
      clearPresence();
      resetTimer();
      tick(true);
    } catch (e) {
      const errStr = typeof e?.message === "object" ? JSON.stringify(e.message) : String(e?.message || e);
      setMsg(`${t("err")}${errStr}`);
      showToast(errStr, getAssetIDByName("CircleXIcon"));
      setAccount(null);
      clearPresence();
      resetTimer();
    } finally {
      loading = false;
    }
  };

  const avatar = account?.avatar || lastfmImg;
  const name = getCleanName(account?.nome) || (storage.username ? `@${storage.username}` : "?");

  return (
    <ReactNative.ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <ReactNative.View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 8 }}>
        <ReactNative.Image source={{ uri: avatar }} style={{ width: 80, height: 80, borderRadius: 20, marginRight: 16, backgroundColor: "#2b2d31" }} />
        <ReactNative.View style={{ flex: 1 }}>
          <Forms.FormText style={{ fontSize: 24, fontWeight: "800" }}>{String(name)}</Forms.FormText>
          <Forms.FormText style={{ opacity: 0.6, fontSize: 13, marginTop: 2 }}>{storage.username ? t("linked") : t("noUser")}</Forms.FormText>
        </ReactNative.View>
      </ReactNative.View>
      <Forms.FormSection title={t("secAuth")}>
        <Forms.FormInput title={t("userField")} placeholder={t("userPlace")} value={storage.username || ""} onChange={(v) => { storage.username = String(v ?? ""); }} />
        <Forms.FormRow label={t("saveBtn")} subLabel={String(msg || t("syncData"))} onPress={onSave} leading={<Forms.FormRow.Icon source={getAssetIDByName("CheckIcon")} />} />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}

function SettingsScreen() {
  useProxy(storage);
  return (
    <ReactNative.ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <Forms.FormSection title={t("secAct")}>
        <Forms.FormInput
          title={t("intervalField")}
          placeholder="5"
          keyboardType="numeric"
          value={String(storage.intervalSec ?? 8)}
          onChange={(v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) {
              storage.intervalSec = Math.max(5, Math.min(120, n));
              resetTimer();
            }
          }}
        />
        <Forms.FormRow label={t("toastToggle")} subLabel={t("toastSub")} leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_search_remix")} />} trailing={<Forms.FormSwitch value={!!storage.toastOnChange} onValueChange={(v) => { storage.toastOnChange = !!v; }} />} />
        <Forms.FormRow label={t("btnToggle")} subLabel={t("btnSub")} leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_link")} />} trailing={<Forms.FormSwitch value={!!storage.showProfileButton} onValueChange={(v) => { storage.showProfileButton = !!v; }} />} />
        <Forms.FormRow label={t("forceBtn")} subLabel={t("forceSub")} onPress={() => tick(true)} leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_sync_24px")} />} />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}

function Settings() {
  useProxy(storage);
  const nav = NavigationNative?.useNavigation?.();

  const openTab = (title, Component) => {
    if (nav?.push) {
      nav.push("VendettaCustomPage", { title, render: Component });
    } else {
      showToast(t("noNav"), getAssetIDByName("CircleXIcon"));
    }
  };

  return (
    <ReactNative.ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <ReactNative.View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 8 }}>
        <ReactNative.Image source={{ uri: lastfmImg }} style={{ width: 84, height: 84, borderRadius: 22, marginRight: 16 }} />
        <ReactNative.View style={{ flex: 1 }}>
          <Forms.FormText style={{ fontSize: 30, fontWeight: "900", lineHeight: 32 }}>PawSync</Forms.FormText>
          <Forms.FormText style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>{t("subTitle")}</Forms.FormText>
        </ReactNative.View>
      </ReactNative.View>
      <Forms.FormSection title={t("secOpts")}>
        <Forms.FormRow label={t("login")} subLabel={storage.username ? `@${storage.username}` : "Configure seu usuário"} leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_account_circle")} />} trailing={Forms.FormRow.Arrow} onPress={() => openTab(t("login"), LoginScreen)} />
        <Forms.FormRow label={t("actSettings")} subLabel={t("actSettingsSub")} leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_cog_24px")} />} trailing={Forms.FormRow.Arrow} onPress={() => openTab(t("actSettings"), SettingsScreen)} />
      </Forms.FormSection>
      <Forms.FormSection title={t("secCredits")} style={{ marginTop: 16 }}>
        <Forms.FormRow label="Vi" subLabel="Dev" leading={<ReactNative.Image source={{ uri: `${api}/api/discord/avatar?id=1117890204569718885` }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }} />} />
        <Forms.FormRow label="Pawsy" subLabel="API" leading={<ReactNative.Image source={{ uri: `${api}/api/discord/avatar?id=1344306431913885727` }} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }} />} />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}

let unregSinc = null;
let unregPaw = null;

const createCmd = (name, desc) => ({
  name,
  displayName: name,
  description: desc,
  displayDescription: desc,
  options: [],
  execute: async () => {
    await tick(true);
    return { type: 4, data: { content: t("synced"), flags: 64 } };
  },
  applicationId: "-1",
  inputType: 1,
  type: 1,
});

export default {
  onLoad: () => {
    if (storage.username === undefined) storage.username = "";
    if (storage.intervalSec == null) storage.intervalSec = 5;
    if (storage.toastOnChange == null) storage.toastOnChange = false;
    if (storage.showProfileButton == null) storage.showProfileButton = true;
    if (storage.applicationId == null) storage.applicationId = "1528577304723329104";

    if (!flux) {
      showToast(t("noFlux"), getAssetIDByName("CircleXIcon"));
      return;
    }

    unregSinc = registerCommand(createCmd("sincronizar", t("cmdDesc")));
    unregPaw = registerCommand(createCmd("pawsync", t("cmdDesc")));

    const u = String(storage.username || "").trim();
    if (!u) {
      showToast(t("noUserErr"), getAssetIDByName("ic_info"));
    } else {
      showToast(t("active"), getAssetIDByName("CheckIcon"));
      tick(false);
      resetTimer();
    }
  },

  onUnload: () => {
    if (timer) clearInterval(timer);
    timer = null;
    clearPresence();
    if (unregSinc) unregSinc();
    if (unregPaw) unregPaw();
  },

  settings: Settings,
};
