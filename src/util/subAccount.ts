import { AccountService } from "../service/accountService";

/**
 * サブアカウントのバリデーション
 */
export async function validateSubAccount(userId: string): Promise<boolean> {
  if (!(await AccountService.hasAccount(userId))) {
    return true;
  }
  if (await AccountService.isSubAccount(userId)) {
    return true;
  }
  return false;
}
