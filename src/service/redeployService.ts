const RAILWAY_GRAPHQL_ENDPOINT = "https://backboard.railway.com/graphql/v2";

type RailwayGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{
    message: string;
  }>;
};

type DeploymentRedeployResponse = {
  deploymentRedeploy: {
    id: string;
    status: string;
  };
};

export class RedeployService {
  private static getProjectToken() {
    console.log("RAILWAY_PROJECT_TOKEN:", process.env.RAILWAY_PROJECT_TOKEN);
    return process.env.RAILWAY_PROJECT_TOKEN;
  }

  private static getDeploymentId() {
    console.log("RAILWAY_DEPLOYMENT_ID:", process.env.RAILWAY_DEPLOYMENT_ID);
    return process.env.RAILWAY_DEPLOYMENT_ID;
  }

  static shouldSchedule() {
    return Boolean(this.getProjectToken() && this.getDeploymentId());
  }

  static async redeployCurrentService() {
    if (!this.shouldSchedule()) {
      return;
    }

    const projectToken = this.getProjectToken();
    const deploymentId = this.getDeploymentId();

    if (!projectToken || !deploymentId) {
      console.warn(
        "railway self redeploy skipped: missing RAILWAY_PROJECT_TOKEN or RAILWAY_DEPLOYMENT_ID",
      );
      return;
    }

    const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": projectToken,
      },
      body: JSON.stringify({
        operationName: "deploymentRedeploy",
        query: `
          mutation deploymentRedeploy($id: String!) {
            deploymentRedeploy(id: $id) {
              id
              status
            }
          }
        `,
        variables: {
          "id": deploymentId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `railway self redeploy failed: ${response.status} ${response.statusText}`,
      );
    }

    const result =
      (await response.json()) as RailwayGraphqlResponse<DeploymentRedeployResponse>;

    console.log("result:", result);

    if (result.errors && result.errors.length > 0) {
      throw new Error(
        `railway self redeploy failed: ${result.errors
          .map((error) => error.message)
          .join(", ")}`,
      );
    }

    console.log(
      "railway self redeploy requested:",
      result.data?.deploymentRedeploy ?? "ok",
    );
  }
}
