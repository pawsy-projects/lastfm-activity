import { React, ReactNative } from "@vendetta/metro/common";
import { Forms } = "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } = "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { resetTimer, tick } from "../activity";
import { t } from "../i18n";

export default function SettingsScreen() {
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
        <Forms.FormRow
          label={t("toastToggle")}
          subLabel={t("toastSub")}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_search_remix")} />}
          trailing={
            <Forms.FormSwitch
              value={!!storage.toastOnChange}
              onValueChange={(v) => { storage.toastOnChange = !!v; }}
            />
          }
        />
        <Forms.FormRow
          label={t("btnToggle")}
          subLabel={t("btnSub")}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_link")} />}
          trailing={
            <Forms.FormSwitch
              value={!!storage.showProfileButton}
              onValueChange={(v) => { storage.showProfileButton = !!v; }}
            />
          }
        />
        <Forms.FormRow
          label={t("forceBtn")}
          subLabel={t("forceSub")}
          onPress={() => tick(true)}
          leading={<Forms.FormRow.Icon source={getAssetIDByName("ic_sync_24px")} />}
        />
      </Forms.FormSection>
    </ReactNative.ScrollView>
  );
}
