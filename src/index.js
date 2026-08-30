import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { registerCommand } from "@vendetta/commands";
import Settings from "./Settings";
import { tick, resetTimer, stopTimer, clearPresence } from "./activity";
import { t } from "./i18n";

const flux = findByProps("dispatch", "subscribe");

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
    stopTimer();
    clearPresence();
    if (unregSinc) unregSinc();
    if (unregPaw) unregPaw();
  },

  settings: Settings,
};
