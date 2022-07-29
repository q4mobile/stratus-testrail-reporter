import { isEmpty } from "lodash";
import moment from "moment";
import type TestrailApiClient from "testrail-api";
import type { IMilestone } from "testrail-api";

export async function getTestRailMilestone(testRailClient: TestrailApiClient, projectId: number): Promise<IMilestone> {
  // @ts-ignore because is_started is not actually required
  const milestoneFilters: IMilestoneFilters = { is_completed: 0 };

  return new Promise((resolve) => {
    testRailClient.getMilestones(projectId, milestoneFilters).then((milestonesResponse) => {
      // @ts-ignore because getMilestones response is typed incorrectly
      const { milestones } = milestonesResponse.body ?? {};

      if (isEmpty(milestones)) {
        testRailClient.addMilestone(projectId, {
          name: `[${moment()
            .tz("America/New_York")
            .format("YYYY-MM-DD")}] Automated Mile Stone`
        }).then((addMilestoneResponse) => {
          resolve(addMilestoneResponse.body ?? {});
        });
      } else {
        resolve(milestones[0]);
      }
    });
  });
}
