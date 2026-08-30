
(() => {
  const { findByProps } = vendetta.metro;
  const { storage } = vendetta.plugin;
  const { showToast } = vendetta.ui.toasts;
  const { getAssetIDByName } = vendetta.ui.assets;
  const { React, ReactNative, NavigationNative } = vendetta.metro.common;
  const { Forms } = vendetta.ui.components;
  const { useProxy } = vendetta.storage;

  const FluxDispatcher = findByProps("dispatch", "subscribe");
  const tokenMod = findByProps("getToken");
  const BASE = "https://pawsy-rapositosas-projects-99beaca1.vercel.app";

  const LASTFM_LOGO = "https://cdn4.iconfinder.com/data/icons/logos-and-brands/512/196_Lastfm_Square_logo_logos-1024.png";
  const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

  // Defaults
  if (storage.username === undefined) storage.username = "";
  if (storage.intervalSec == null) storage.intervalSec = 5;
  if (storage.toastOnChange == null) storage.toastOnChange = false;
  if (storage.showProfileButton == null) storage.showProfileButton = true;
  if (storage.applicationId == null) storage.applicationId = "1528577304723329104";

  let timer = null;
  let lastKey = "";
  let trackStartedAt = null;
  let trackDurationSec = 210;
  let validating = false;
  const assetCache = {};
  const deezerCache = {};

  function parseName(nome) {
    if (!nome) return "";
    if (typeof nome === "string") return nome;
    if (typeof nome === "object") return nome.username || nome.apelido || "";
    return String(nome);
  }

  function sendActivity(activity) {
    if (!FluxDispatcher?.dispatch) return;
    FluxDispatcher.dispatch({
      type: "LOCAL_ACTIVITY_UPDATE",
      activity,
      pid: 1608,
      socketId: "pawsy@lastfm",
    });
  }

  function clearActivity() {
    sendActivity(null);
    lastKey = "";
    trackStartedAt = null;
    trackDurationSec = 210;
  }

  function cleanTitle(title) {
    if (!title) return "?";
    const i = title.indexOf(" (");
    if (i > 0) return title.slice(0, i).trim();
    return title.trim();
  }

  function isPlaceholderCover(url) {
    if (!url || typeof url !== "string") return true;
    const u = url.toLowerCase();
    return (
      u.includes("2a96cbd8b46e442fc41c2b86b821562f") ||
      u.includes("default") ||
      u.includes("/star") ||
      u.includes("empty") ||
      u.includes("placeholder")
    );
  }

  async function deezerLookup(song, artist) {
    const key = (song + "|" + artist).toLowerCase();
    if (deezerCache[key]) return deezerCache[key];
    try {
      let res = await fetch(
        "https://api.deezer.com/search?q=" +
          encodeURIComponent('track:"' + song + '" artist:"' + artist + '"') +
          "&limit=5"
      );
      let data = await res.json();
      let hit = data?.data?.[0];
      if (!hit) {
        res = await fetch(
          "https://api.deezer.com/search?q=" +
            encodeURIComponent(song + " " + artist) +
            "&limit=5"
        );
        data = await res.json();
        hit = data?.data?.[0];
      }
      const out = {
        cover: hit?.album?.cover_xl || hit?.album?.cover_big || hit?.album?.cover_medium || null,
        duration: typeof hit?.duration === "number" ? hit.duration : null,
        link: hit?.link || null,
      };
      deezerCache[key] = out;
      return out;
    } catch (e) {
      return { cover: null, duration: null, link: null };
    }
  }

  async function toMpAsset(imageUrl) {
    if (!imageUrl) return null;
    if (assetCache[imageUrl]) return assetCache[imageUrl];
    try {
      const token = tokenMod?.getToken?.();
      if (!token) return null;
      const res = await fetch(
        "https://discord.com/api/v9/applications/" + storage.applicationId + "/external-assets",
        {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: JSON.stringify({ urls: [imageUrl] }),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const path = data?.[0]?.external_asset_path || data?.external_asset_path;
      if (!path) return null;
      const mp = String(path).startsWith("mp:") ? path : "mp:" + path;
      assetCache[imageUrl] = mp;
      return mp;
    } catch (e) {
      return null;
    }
  }

  async function fetchUser(username) {
    const res = await fetch(BASE + "/api/lastfm/user?username=" + encodeURIComponent(username));
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function validateUsername(name) {
    const u = String(name || "").trim();
    if (!u) throw new Error("Usuário é obrigatório.");
    const data = await fetchUser(u);
    if (!data?.nome || data.status === 404) {
      throw new Error("Usuário não encontrado.");
    }
    return data;
  }

  async function tick(force) {
    const user = String(storage.username || "").trim();
    if (!user) {
      if (force) showToast("Configure sua conta em 🔧", getAssetIDByName("CircleXIcon"));
      clearActivity();
      return;
    }

    try {
      const data = await fetchUser(user);
      const p = data?.presença;

      if (!p?.escutando || !p.musica) {
        if (lastKey !== "" || force) {
          clearActivity();
          if (force) showToast("Nada tocando", getAssetIDByName("ic_info"));
        }
        return;
      }

      const rawSong = p.musica.nome || "?";
      const song = cleanTitle(rawSong);
      const artist = p.musica.artista || "?";
      const trackPlays = p.musica.vezes_tocada;
      const coverIn = typeof p.musica.capa === "string" ? p.musica.capa : null;
      const profileUrl = (data.perfil && String(data.perfil).startsWith("http") ? data.perfil : null) || "https://www.last.fm/pt/user/" + encodeURIComponent(user);

      const key = song + "|" + artist;
      const changed = key !== lastKey;

      if (changed || !trackStartedAt) {
        trackStartedAt = Date.now();
      }

      const dz = await deezerLookup(song, artist);
      if (dz.duration && dz.duration > 0) {
        trackDurationSec = dz.duration;
      } else if (changed) {
        trackDurationSec = 210;
      }

      let coverUrl = coverIn;
      if (isPlaceholderCover(coverUrl)) coverUrl = dz.cover || coverUrl;
      const large = await toMpAsset(coverUrl);

      const start = trackStartedAt;
      const end = start + trackDurationSec * 1000;
      const stateLine = trackPlays != null ? "de " + artist + " • " + trackPlays : "de " + artist;

      const activity = {
        name: "Last.fm",
        application_id: String(storage.applicationId),
        type: 2,
        details: song,
        state: stateLine,
        timestamps: { start, end },
        assets: {},
        flags: 0,
      };

      if (large) {
        activity.assets.large_image = large;
        activity.assets.large_text = artist;
      }

      if (storage.showProfileButton && profileUrl) {
        activity.buttons = ["Perfil"];
        activity.metadata = { button_urls: [profileUrl] };
      }

      if (changed) {
        clearActivity();
        trackStartedAt = start;
        lastKey = "";
        setTimeout(() => {
          sendActivity(activity);
          lastKey = key;
        }, 150);
      } else {
        sendActivity(activity);
        lastKey = key;
      }

      if ((changed && storage.toastOnChange) || (force && !changed)) {
        showToast(artist + " - " + song, getAssetIDByName("CheckIcon"));
      }
    } catch (e) {
      if (force) showToast("Erro: " + (e?.message || e), getAssetIDByName("CircleXIcon"));
    }
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    const user = String(storage.username || "").trim();
    if (!user) return;
    const sec = Math.max(5, Number(storage.intervalSec) || 8);
    timer = setInterval(() => tick(false), sec * 1000);
  }

  const { registerCommand } = vendetta.commands;
  let unregSinc = null;
  let unregPaw = null;

  const buildCmd = (name, desc) => ({
    name,
    displayName: name,
    description: desc,
    displayDescription: desc,
    options: [],
    execute: async () => {
      await tick(true);
      return { type: 4, data: { content: "sincronizado!", flags: 64 } };
    },
    applicationId: "-1",
    inputType: 1,
    type: 1,
  });

  function LoginScreen() {
    useProxy(storage);
    const [status, setStatus] = React.useState("");
    const [userData, setUserData] = React.useState(null);

    const loadCurrentInfo = React.useCallback(async () => {
      const u = String(storage.username || "").trim();
      if (!u) {
        setUserData(null);
        return;
      }
      try {
        const d = await fetchUser(u);
        setUserData(d);
      } catch (e) {
        setUserData(null);
      }
    }, []);

    React.useEffect(() => {
      loadCurrentInfo();
    }, [loadCurrentInfo]);

    const saveUser = async () => {
      const u = String(storage.username || "").trim();
      if (!u) {
        setStatus("Digite o nome...");
        showToast("Usuário obrigatório.", getAssetIDByName("CircleXIcon"));
        setUserData(null);
        clearActivity();
        restartTimer();
        return;
      }
      if (validating) return;
      validating = true;
      setStatus("Validando...");
      try {
        const data = await validateUsername(u);
        storage.username = u;
        setUserData(data);
        setStatus("Conectado como: @" + u);
        showToast("Last.fm: " + u, getAssetIDByName("CheckIcon"));
        clearActivity();
        restartTimer();
        tick(true);
      } catch (e) {
        const errText = typeof e?.message === "object" ? JSON.stringify(e.message) : String(e?.message || e);
        setStatus("Erro: " + errText);
        showToast(errText, getAssetIDByName("CircleXIcon"));
        setUserData(null);
        clearActivity();
        restartTimer();
      } finally {
        validating = false;
      }
    };

    const avatarUrl = userData?.avatar || LASTFM_LOGO;
    const displayName = parseName(userData?.nome) || (storage.username ? "@" + storage.username : "?");

    return React.createElement(
      ReactNative.ScrollView,
      { style: { flex: 1 }, contentContainerStyle: { padding: 16 } },

     
      React.createElement(
        ReactNative.View,
        { style: { flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 8 } },
        React.createElement(ReactNative.Image, {
          source: { uri: avatarUrl },
          style: { width: 80, height: 80, borderRadius: 20, marginRight: 16, backgroundColor: "#2b2d31" }
        }),
        React.createElement(
          ReactNative.View,
          { style: { flex: 1 } },
          React.createElement(Forms.FormText, { style: { fontSize: 24, fontWeight: "800" } }, String(displayName)),
          React.createElement(Forms.FormText, { style: { opacity: 0.6, fontSize: 13, marginTop: 2 } },
            storage.username ? "As músicas que ouvir nesta conta será exibido no seu perfil!" : "Nenhum usuario vinculado"
          )
        )
      ),

      React.createElement(
        Forms.FormSection,
        { title: "REGISTRO:" },
        React.createElement(Forms.FormInput, {
          title: "Seu nome de usuário:",
          placeholder: "Digite aqui...",
          value: storage.username || "",
          onChange: (v) => { storage.username = String(v ?? ""); },
        }),
        React.createElement(Forms.FormRow, {
          label: "Validar e salvar a Conta",
          subLabel: String(status || "Sua conta será salva para sempre lembrar de ti."),
          onPress: saveUser,
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("CheckIcon") })
        })
      )
    );
  }

 
  function SettingsScreen() {
    useProxy(storage);
    return React.createElement(
      ReactNative.ScrollView,
      { style: { flex: 1 }, contentContainerStyle: { padding: 16 } },
      React.createElement(
        Forms.FormSection,
        { title: "ATIVIDADE:" },
        React.createElement(Forms.FormInput, {
          title: "Tempo de intervalo (segundos):",
          placeholder: "5",
          keyboardType: "numeric",
          value: String(storage.intervalSec ?? 5),
          onChange: (v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) {
              storage.intervalSec = Math.max(5, Math.min(120, n));
              restartTimer();
            }
          },
        }),
        React.createElement(Forms.FormRow, {
          label: "Notificar troca de música",
          subLabel: "Exibe um pequeno pop-up quando a faixa é alterada.",
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("ic_search_remix") }),
          trailing: React.createElement(Forms.FormSwitch, {
            value: !!storage.toastOnChange,
            onValueChange: (v) => { storage.toastOnChange = !!v; },
          })
        }),
        React.createElement(Forms.FormRow, {
          label: "Perfil",
          subLabel: "(beta) exibe botões na atividade",
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("ic_link") }),
          trailing: React.createElement(Forms.FormSwitch, {
            value: !!storage.showProfileButton,
            onValueChange: (v) => { storage.showProfileButton = !!v; },
          })
        }),
        React.createElement(Forms.FormRow, {
          label: "Forçar sincronização",
          subLabel: "Atualize independente do tempo de espera.",
          onPress: () => tick(true),
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("ic_sync_24px") })
        })
      )
    );
  }

  // UI Principal
  function Settings() {
    useProxy(storage);
    const navigation = NavigationNative?.useNavigation?.();

    const navigateTo = (titleName, Component) => {
      if (navigation?.push) {
        navigation.push("VendettaCustomPage", {
          title: titleName,
          render: Component,
        });
      } else {
        showToast("Navegação não disponível", getAssetIDByName("CircleXIcon"));
      }
    };

    return React.createElement(
      ReactNative.ScrollView,
      { style: { flex: 1 }, contentContainerStyle: { padding: 16, paddingBottom: 40 } },

      
      React.createElement(
        ReactNative.View,
        { style: { flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 8 } },
        React.createElement(ReactNative.Image, {
          source: { uri: LASTFM_LOGO },
          style: { width: 84, height: 84, borderRadius: 22, marginRight: 16 }
        }),
        React.createElement(
          ReactNative.View,
          { style: { flex: 1 } },
          React.createElement(Forms.FormText, { style: { fontSize: 30, fontWeight: "900", lineHeight: 32 } }, "PawSync"),
          React.createElement(Forms.FormText, { style: { opacity: 0.7, fontSize: 13, marginTop: 4 } }, "Exiba o que você está ouvindo no Last.fm de forma fácil e prática.")
        )
      ),

     
      React.createElement(
        Forms.FormSection,
        { title: "OPÇÕES" },
        React.createElement(Forms.FormRow, {
          label: "Login & Conta",
          subLabel: storage.username ? "@" + storage.username : "Registrar uma conta para sincronizar",
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("ic_account_circle") }),
          trailing: Forms.FormRow.Arrow,
          onPress: () => navigateTo("Login & Conta", LoginScreen)
        }),
        React.createElement(Forms.FormRow, {
          label: "Configurações de Atividade",
          subLabel: "Personalize a atividade.",
          leading: React.createElement(Forms.FormRow.Icon, { source: getAssetIDByName("ic_cog_24px") }),
          trailing: Forms.FormRow.Arrow,
          onPress: () => navigateTo("Configurações", SettingsScreen)
        })
      ),

      React.createElement(
        Forms.FormSection,
        { title: "CRÉDITOS:", style: { marginTop: 16 } },
        React.createElement(Forms.FormRow, {
          label: "Vi",
          subLabel: "Dev",
          leading: React.createElement(ReactNative.Image, {
            source: { uri: "https://pawsy-rapositosas-projects-99beaca1.vercel.app/api/discord/avatar?id=1117890204569718885" },
            style: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }
          })
        }),
        React.createElement(Forms.FormRow, {
          label: "Pawsy",
          subLabel: "API",
          leading: React.createElement(ReactNative.Image, {
            source: { uri: "https://pawsy-rapositosas-projects-99beaca1.vercel.app/api/discord/avatar?id=1344306431913885727" },
            style: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }
          })
        })
      )
    );
  }

  return {
    onLoad: () => {
      if (!FluxDispatcher) {
        showToast("Erro: flux.dispatcher não encontrado", getAssetIDByName("CircleXIcon"));
        return;
      }
      unregSinc = registerCommand(buildCmd("sincronizar", "Forçar sincronização do Last.fm"));

      const u = String(storage.username || "").trim();
      if (!u) {
        showToast("PawSync: Configure seu username", getAssetIDByName("ic_info"));
      } else {
        showToast("ativo!", getAssetIDByName("CheckIcon"));
        tick(false);
        restartTimer();
      }
    },
    onUnload: () => {
      if (timer) clearInterval(timer);
      timer = null;
      clearActivity();
      if (unregSinc) unregSinc();
      if (unregPaw) unregPaw();
    },
    settings: Settings,
  };
})();