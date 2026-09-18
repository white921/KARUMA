import {
  TextChannel,
  Client,
  MessageFlags,
  ChatInputCommandInteraction,
  ThreadChannel,
} from "discord.js";

/**
 * 既存のパネルメッセージを削除
 * @param channel チャンネル
 * @param client クライアント
 * @param title パネルメッセージのタイトル
 */
export async function deletePanelMessage(
  channel: TextChannel | ThreadChannel,
  client: Client,
  title: string
) {
  const messages = await channel.messages.fetch({ limit: 10 });
  const filteredMessages = messages.filter(
    (msg) =>
      msg.author.id === client.user?.id &&
      msg.embeds.length > 0 &&
      msg.embeds[0].title?.includes(title)
  );

  for (const message of filteredMessages.values()) {
    await message.delete();
  }
}

/**
 * エフェメラルなメッセージを送信
 * @param interaction インタラクション
 * @param content メッセージ内容
 * 一度メッセージを削除しないとephemeralをtrueにすることができない
 */
export async function sendEphemeralMessage(
  interaction: ChatInputCommandInteraction,
  content: string
) {
  try {
    await interaction.deleteReply();
    await interaction.followUp({
      content: content,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    throw error;
  }
}
