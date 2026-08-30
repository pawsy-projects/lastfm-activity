import { React, ReactNative } from "@vendetta/metro/common";
import { Forms } = "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } = "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { getUser, checkUser, getCleanName } from "../api";
import { lastfmImg } from "../constants";
import { clearPresence, resetTimer, tick } from "../activity";
import { t } from "../i18n";

let loading = false;

export default function LoginScreen() {
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

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onSave = async () => {
    const u = String(storage.username || "").trim();
    if (!u) {
      setMsg("username...");
      showToast(t("userReq"), getAssetIDByName("CircleXIcon"));
      setAccount(null);
      clearPresence();
      resetTimer();
      return;
    }
    if (loading) return;
    loading = true;
    setMsg("loading...");
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
        <ReactNative.Image
          source={{ uri: avatar }}
          style={{ width: 80, height: 80, borderRadius: 20, marginRight: 16, backgroundColor: "#2b2d31" }}
        />
        <ReactNative.View style={{ flex: 1 }}>
          <Forms.FormText style={{ fontSize: 24, fontWeight: "800" }}>{String(name)}</Forms.FormText>
          <Forms.FormText style={{ opacity: 0.6, fontSize: 13, marginTop: 2 }}>
            {storage.username ? t("linked") : t("noUser")}
          </Forms.FormText>
        </ReactNative.View>
      </ReactNative.View>

      <Forms.FormSection title={t("secAuth")}>
        <Forms.FormInput
          title={t("userField")}
          placeholder={t("userPlace")}
          value={storage.username || ""}
          onChange={(v) => { storage.username = String(v ?? ""); }}
        />
        <Forms.FormRow
          label={t("saveBtn")}
          subLabel={String(msg || t("syncData"))}
          onPress={onSave}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("CheckIcon")} />}
        />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}
