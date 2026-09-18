import type { PANEL_INSTALL_TARGETS } from "../../constant/panel/panelInstall";

export type PanelInstallTarget =
  (typeof PANEL_INSTALL_TARGETS)[keyof typeof PANEL_INSTALL_TARGETS];
