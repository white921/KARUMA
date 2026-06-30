export interface Evaluation {
  id: number;
  user_id: string;
  male_invites: number;
  female_invites: number;
  total_invite_extension_days: number;
  total_bonus_extension_days: number;
  total_bonus_maru: number;
  reason: string;
  created_at: Date;
  expire_at: Date | null;
  updated_at: Date;
}
