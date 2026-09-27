import { ROLE_IDS } from "../shared/id";

export const MEETING_CATEGORY_ID = "1535329073759526942";
export const MEETING_PANEL_CHANNEL_ID = "1553601403262337044";
export const MEETING_SELECT_ID = "meeting_vc:create";
export const MEETING_VC_TYPE = "MEETING";
export const MEETING_JOIN_GRACE_MS = 5 * 60 * 1000;

export type MeetingTemplate = { id: string; label: string; roleIds?: readonly string[] };

// 固定VCが残っていれば最新権限を参照し、削除済みなら保存済み権限を使用する。
export const MEETING_TEMPLATES: readonly MeetingTemplate[] = [
  { id: "1536031521226625114", label: "運営" },
  { id: "1536030581379571712", label: "案内人" },
  { id: "1536031566273450064", label: "判定官" },
  { id: "1536031760876306582", label: "巡礼者" },
  { id: "1536031850579890226", label: "市場" },
  { id: "1536031887984820386", label: "財務" },
  { id: "1536031928623300698", label: "歓楽" },
  { id: "1536032503771439174", label: "祭典" },
  { id: "1536032826707808376", label: "裁判" },
  { id: "1536032875936481280", label: "狭間" },
  { id: "1536032983927230524", label: "収容" },
  { id: "1545086685178626078", label: "劇場" },
  { id: "1551232192766677112", label: "システム" },
  { id: "mansion_cafe", label: "お屋敷喫茶", roleIds: [ROLE_IDS.CAST_MANAGER, ROLE_IDS.CAST_BUTLER, ROLE_IDS.CAST_MAID] },
];
