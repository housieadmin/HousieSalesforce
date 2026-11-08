import { defineWorkflow } from "../framework/scenario";
import captureHome from "./capture-org-home.scenario";
import inspectHome from "./inspect-org-home.scenario";

export default defineWorkflow({
  id: "org-home-inspection",
  description: "Capture a screenshot and collect basic page information.",
  scenarios: [inspectHome, captureHome]
});
