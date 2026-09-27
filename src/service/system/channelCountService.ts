import { ChannelType, Client, DMChannel, GuildChannel } from "discord.js";
import { TEXT_CHANNEL_IDS } from "../../constant/shared/id";

export const CHANNEL_COUNT_UPDATE_INTERVAL_MS = 305_000;
const EVENT_DELAY_MS = 5_000;

export class ChannelCountService {
  private lastRenameAt = -Infinity;
  private updating = false;
  private started = false;
  private pending: NodeJS.Timeout | null = null;
  private polling: NodeJS.Timeout | null = null;

  constructor(private client: Client, private guildId: string) {}

  private onChannelChange = (channel: GuildChannel | DMChannel) => {
    if ("guild" in channel && channel.guild.id === this.guildId) this.schedule();
  };

  private schedule() {
    if (this.pending) return;
    const delay = Math.max(EVENT_DELAY_MS, this.lastRenameAt + CHANNEL_COUNT_UPDATE_INTERVAL_MS - Date.now());
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.refresh().catch(error => console.error("[ChannelCount] 更新失敗:", error));
    }, delay);
    this.pending.unref();
  }

  async refresh() {
    if (!this.client.isReady()) return;
    if (this.updating || Date.now() - this.lastRenameAt < CHANNEL_COUNT_UPDATE_INTERVAL_MS) {
      this.schedule();
      return;
    }
    this.updating = true;
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      if (!guild.available) return;
      // GET /guilds/{id}/channels の結果だけを数える。スレッド入りのキャッシュは使わない。
      const channels = await guild.channels.fetch();
      const target = channels.get(TEXT_CHANNEL_IDS.CHANNEL_COUNT);
      if (!target || target.type !== ChannelType.GuildText) {
        throw new Error("チャンネル数表示用のTCが見つかりません。");
      }
      const count = channels.filter(channel => channel !== null && !channel.isThread()).size;
      const name = `${count}/500`;
      if (target.name === name) return;
      // リクエスト中のイベントや失敗時にも、名前変更が連続しないようにする。
      this.lastRenameAt = Date.now();
      await target.setName(name, "サーバー全体のチャンネル数を更新（カテゴリー込み・スレッド除外）");
      console.log(`[ChannelCount] updated ${name}`);
    } finally {
      this.updating = false;
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.client.on("channelCreate", this.onChannelChange);
    this.client.on("channelDelete", this.onChannelChange);
    // 手動の名前変更も次回の更新で戻す。自分の名前変更による再確認は同名なら書き込まない。
    this.client.on("channelUpdate", this.onChannelChange);
    this.polling = setInterval(() => this.schedule(), CHANNEL_COUNT_UPDATE_INTERVAL_MS);
    this.polling.unref();
    void this.refresh().catch(error => console.error("[ChannelCount] 初回更新失敗:", error));
  }

  stop() {
    this.client.off("channelCreate", this.onChannelChange);
    this.client.off("channelDelete", this.onChannelChange);
    this.client.off("channelUpdate", this.onChannelChange);
    if (this.pending) clearTimeout(this.pending);
    if (this.polling) clearInterval(this.polling);
    this.pending = this.polling = null;
    this.started = false;
  }
}
