import { EmbedBuilder, GuildMember } from "discord.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { AccountService } from "./accountService";

import { ACCOUNT_MESSAGES } from "../../constant/account/account";
import { COLOR } from "../../constant/shared/color";
import { CURRENCY_NAMES } from "../../constant/currency/currency";
import { RETURN_MEMBER_MESSAGES } from "../../constant/account/returnMember";
import { formatNumber } from "../../util/shared/number";

dayjs.extend(utc);
dayjs.extend(timezone);

export class ReturnMemberService {
  static async createReturnMemberEmbed(targetMember: GuildMember) {
    const account = await AccountService.getAccountByUserId(targetMember.id);
    const targetAccount = account[0];
    if (!targetAccount) {
      throw new Error(ACCOUNT_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    const basicRoleMention = targetAccount.left_core_member_roles
      ? `<@&${targetAccount.left_core_member_roles}>`
      : RETURN_MEMBER_MESSAGES.NO_BASIC_ROLE;

    const leftDate = targetAccount.left_at
      ? this.formatDate(targetAccount.left_at)
      : RETURN_MEMBER_MESSAGES.NO_HISTORY;

    const leftWallet = targetAccount.left_wallet === null
      ? RETURN_MEMBER_MESSAGES.NO_HISTORY
      : `${formatNumber(targetAccount.left_wallet)}${CURRENCY_NAMES}`;

    return new EmbedBuilder()
      .setColor(COLOR.COBALT_GREEN)
      .setTitle("出戻り情報")
      .setDescription(`<@${targetMember.id}> の確認結果です。`)
      .addFields(
        {
          name: "基本ロール",
          value: basicRoleMention,
          inline: true,
        },
        {
          name: "鯖抜け時の表示名",
          value: targetAccount.user_name || RETURN_MEMBER_MESSAGES.NO_HISTORY,
          inline: false,
        },
        {
          name: "出戻り回数",
          value: String(targetAccount.left_count),
          inline: true,
        },
        {
          name: "抜けた時の残高",
          value: leftWallet,
          inline: true,
        },
        {
          name: "抜けた日付",
          value: leftDate,
          inline: true,
        },
      )
      .setTimestamp(new Date());
  }

  private static formatDate(date: Date) {
    return dayjs(date).tz("Asia/Tokyo").format("YYYY/MM/DD");
  }
}
