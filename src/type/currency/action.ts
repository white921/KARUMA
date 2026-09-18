export interface Action {
  id: number;
  command_name: string;
  amount: number;
  from_user_id: string;
  to_user_id: string;
  from_after_wallet: number;
  to_after_wallet: number;
  comment: string;
  created_at: Date;
}
