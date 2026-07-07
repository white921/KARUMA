import { ROLE_IDS } from "./id";

export const SERVER_BOOST_FIRST_REWARD = 30000;
export const SERVER_BOOST_AFTER_REWARD = 5000;

export const SALARY_PAYMENTS: Record<string, number> = {
  [ROLE_IDS.GIJUTU_LEADER]: 10000,
};
export const SALARY_ROLE_IDS: Record<string, string> = {
  GIJUTU_LEADER: ROLE_IDS.GIJUTU_LEADER,
};

export const TEST_SALARY_PAYMENTS: Record<string, number> = {};
export const TEST_SALARY_ROLE_IDS: Record<string, string> = {};
