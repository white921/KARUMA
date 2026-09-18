export type RailwayGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

export type DeploymentRedeployResponse = {
  deploymentRedeploy: {
    id: string;
    status: string;
  };
};
