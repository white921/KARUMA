import { ChannelType, Client, DMChannel, GuildChannel } from "discord.js";
import { VC_IDS } from "../../constant/shared/id";

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

export class ChannelCountService {
  private rerun = false;
  private updating = false;
  private started = false;
  private pending: NodeJS.Timeout | null = null;
  private polling: NodeJS.Timeout | null = null;

  constructor(private client: Client, private guildId: string) {}

  private onChannelChange = (channel: GuildChannel | DMChannel) => {
    if ("guild" in channel && channel.guild.id === this.guildId) this.schedule();
  };

  private onChannelUpdate = (channel: GuildChannel | DMChannel) => {
    if (channel.id === VC_IDS.CHANNEL_COUNT) this.onChannelChange(channel);
  };

  private schedule() {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      void this.refresh().catch(error => console.error("[ChannelCount] 更新失敗:", error));
    }, 0);
    this.pending.unref();
  }

  async refresh() {
    if (!this.client.isReady()) return;
    if (this.updating) {
      this.rerun = true;
      return;
    }
    this.updating = true;
    try {
      const guild = await this.client.guilds.fetch(this.guildId);
      if (!guild.available) return;
      // GET /guilds/{id}/channels の結果だけを数える。スレッド入りのキャッシュは使わない。
      const channels = await guild.channels.fetch();
      const target = channels.get(VC_IDS.CHANNEL_COUNT);
      if (!target || target.type !== ChannelType.GuildVoice) {
        throw new Error("チャンネル数表示用のVCが見つかりません。");
      }
      const count = channels.filter(channel => channel !== null && !channel.isThread()).size;
      const name = `チャンネル数 ${count}/500`;
      if (target.name === name) return;
      // 固定の待機は設けない。Discordの429応答による待機・再試行はdiscord.jsに任せる。
      await target.setName(name, "サーバー全体のチャンネル数を更新（カテゴリー込み・スレッド除外）");
      console.log(`[ChannelCount] updated ${name}`);
    } finally {
      this.updating = false;
      if (this.rerun) {
        this.rerun = false;
        this.schedule();
      }
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.client.on("channelCreate", this.onChannelChange);
    this.client.on("channelDelete", this.onChannelChange);
    // 手動の名前変更も次回の更新で戻す。自分の名前変更による再確認は同名なら書き込まない。
    this.client.on("channelUpdate", this.onChannelUpdate);
    this.polling = setInterval(() => this.schedule(), RECONCILE_INTERVAL_MS);
    this.polling.unref();
    void this.refresh().catch(error => console.error("[ChannelCount] 初回更新失敗:", error));
  }

  stop() {
    this.client.off("channelCreate", this.onChannelChange);
    this.client.off("channelDelete", this.onChannelChange);
    this.client.off("channelUpdate", this.onChannelUpdate);
    if (this.pending) clearTimeout(this.pending);
    if (this.polling) clearInterval(this.polling);
    this.pending = this.polling = null;
    this.started = false;
  }
}
