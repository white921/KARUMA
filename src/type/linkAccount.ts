export type RoleBackedMember = {
  roles?: {
    cache?: {
      has: (roleId: string) => boolean;
    };
  };
};
