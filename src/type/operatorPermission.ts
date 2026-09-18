export type RoleBackedMember = {
  roles?: string[] | { cache?: { has: (roleId: string) => boolean } };
};
