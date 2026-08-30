import { React, ReactNative, NavigationNative } from "@vendetta/metro/common";
import { Forms } = "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } = "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { lastfmImg, api } from "./constants";
import LoginScreen from "./components/LoginScreen";
import SettingsScreen from "./components/SettingsScreen";
import { t } from "./i18n";

export default function Settings() {
  useProxy(storage);
  const nav = NavigationNative?.useNavigation?.();

  const openTab = (title, Component) => {
    if (nav?.push) {
      nav.push("VendettaCustomPage", {
        title,
        render: Component,
      });
    } else {
      showToast(t("noNav"), getAssetIDByName("CircleXIcon"));
    }
  };

  return (
    <ReactNative.ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <ReactNative.View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 8 }}>
        <ReactNative.Image
          source={{ uri: lastfmImg }}
          style={{ width: 84, height: 84, borderRadius: 22, marginRight: 16 }}
        />
        <ReactNative.View style={{ flex: 1 }}>
          <Forms.FormText style={{ fontSize: 30, fontWeight: "900", lineHeight: 32 }}>PawSync</Forms.FormText>
          <Forms.FormText style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
            {t("subTitle")}
          </Forms.FormText>
        </ReactNative.View>
      </ReactNative.View>

      <Forms.FormSection title={t("secOpts")}>
        <Forms.FormRow
          label={t("login")}
          subLabel={storage.username ? `@${storage.username}` : "Configure seu usuario"}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_account_circle")} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => openTab(t("login"), LoginScreen)}
        />
        <Forms.FormRow
          label={t("actSettings")}
          subLabel={t("actSettingsSub")}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_cog_24px")} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => openTab(t("actSettings"), SettingsScreen)}
        />
      </Forms.FormSection>

      <Forms.FormSection title={t("secCredits")} style={{ marginTop: 16 }}>
        <Forms.FormRow
          label="Vi (rapositosa)"
          subLabel="Dev"
          leading={
            <ReactNative.Image
              source={{ uri: `${api}/api/discord/avatar?id=1117890204569718885` }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }}
            />
          }
        />
        <Forms.FormRow
          label="Pawsy"
          subLabel="API"
          leading={
            <ReactNative.Image
              source={{ uri: `${api}/api/discord/avatar?id=1344306431913885727` }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#2b2d31" }}
            />
          }
        />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}
