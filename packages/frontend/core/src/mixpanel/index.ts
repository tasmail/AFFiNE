import type { PlanChangeStartedEvent } from './plan-change-started';
import type { PlanChangeSucceededEvent } from './plan-change-succeed';

export type MixpanelEvents = {
  PlanChangeStarted: PlanChangeStartedEvent;
  PlanChangeSucceeded: PlanChangeSucceededEvent;
};
