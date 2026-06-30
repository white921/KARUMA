export interface Account {
  user_id: string;
  user_name: string;
  wallet: number;
  is_frozen: boolean;
  left_count: number;
  left_at: Date | null;
  left_core_member_roles: string | null;
  boost_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface DebitResult {
  userId: string;
  beforeWallet: number;
}
