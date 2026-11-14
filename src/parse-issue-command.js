const workflows = {
  deploy: "salesforce-ai-iteration-deploy.yml",
  "deploy-and-verify": "salesforce-deploy-and-verify.yml",
  restore: "salesforce-ai-iteration-restore.yml",
  retrieve: "salesforce-org-sync.yml"
};

const listFields = new Set(["paths", "apex_test_classes", "scenarios"]);
const validRef = value => value && value.length <= 200 && !value.startsWith("-") &&
  !value.includes("..") && !value.includes("//") && /^[A-Za-z0-9._/-]+$/.test(value);
const validMetadataPath = value => value.length <= 240 && /^force-app\/[A-Za-z0-9._/-]+$/.test(value) &&
  !value.includes("..") && !value.includes("//") && !value.endsWith("/");
const validScenarioPath = value => value.length <= 240 && /^tests\/browser\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(value) &&
  !value.includes("..") && !value.includes("//");

function parseFields(lines, allowed) {
  const fields = {};
  let activeList = null;
  for (const line of lines) {
    if (!line) continue;
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!allowed.has(key) || Object.hasOwn(fields, key)) throw new Error("Unknown or duplicate field: " + key);
      fields[key] = value;
      activeList = listFields.has(key) ? key : null;
      if (activeList && value) throw new Error("Use one '- value' per line under " + key + ":");
    } else if (line.startsWith("- ") && activeList) {
      fields[activeList] += (fields[activeList] ? "\n" : "") + line.slice(2).trim();
    } else throw new Error("Unexpected command line.");
  }
  return fields;
}

export function parseIssueCommand(body, authorAssociation = "OWNER") {
  if (authorAssociation !== "OWNER") throw new Error("Only repository owners may run Salesforce commands.");
  const lines = String(body || "").split(/\r?\n/).map(line => line.trim());
  const command = lines.shift();
  if (!command?.startsWith("/sf ") || !Object.hasOwn(workflows, command.slice(4))) {
    throw new Error("Supported commands: /sf deploy, /sf deploy-and-verify, /sf restore, /sf retrieve.");
  }
  const kind = command.slice(4);
  const retrieve = kind === "retrieve";
  const deploy = kind === "deploy" || kind === "deploy-and-verify";
  const allowed = retrieve
    ? new Set(["paths", "create_pr", "description"])
    : deploy
      ? new Set(["ref", "paths", "mode", "tests", "apex_test_classes", "scenarios", "description", "confirm"])
      : new Set(["ref", "paths", "run_local_tests", "confirm"]);
  const fields = parseFields(lines, allowed);
  const paths = (fields.paths || "").split("\n").map(x => x.trim()).filter(Boolean);
  if (retrieve) {
    if (paths.length > 25 || new Set(paths).size !== paths.length) throw new Error("Provide at most 25 unique retrieve paths.");
    const manifests = paths.filter(x => x.endsWith(".xml"));
    if (manifests.length > 1 || (manifests.length && paths.length > 1)) throw new Error("Use one manifest or component paths.");
    if (paths.some(x => !(validMetadataPath(x) || /^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(x) && !x.includes("..") && !x.includes("//")))) {
      throw new Error("Invalid retrieve path.");
    }
    const createPr = fields.create_pr || "true";
    if (!["true", "false"].includes(createPr)) throw new Error("create_pr must be true or false.");
    return {
      kind, workflowId: workflows[kind], paths,
      inputs: {
        confirm_sync: "SYNC",
        retrieve_paths: paths.filter(x => !x.endsWith(".xml")).join("\n"),
        retrieve_manifest: manifests[0] || "manifest/package-retrieve.xml",
        create_pr: createPr,
        run_description: (fields.description || "Issue initiated metadata retrieval").slice(0, 300)
      }
    };
  }
  const ref = (fields.ref || "").trim();
  if (!validRef(ref)) throw new Error("ref must be a valid branch, tag or commit SHA.");
  if (!paths.length || paths.length > 25 || new Set(paths).size !== paths.length || paths.some(x => !validMetadataPath(x))) {
    throw new Error("Provide 1-25 unique paths under force-app/.");
  }
  if (deploy) {
    const mode = fields.mode || "standard";
    const tests = fields.tests || "none";
    if (!["standard", "fast"].includes(mode)) throw new Error("mode must be standard or fast.");
    if (!["none", "specified", "local"].includes(tests)) throw new Error("tests must be none, specified or local.");
    if (mode === "fast" && tests !== "none") throw new Error("fast mode requires tests=none.");
    const classes = (fields.apex_test_classes || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (tests === "specified" && (!classes.length || classes.length > 30 || classes.some(x => !/^[A-Za-z][A-Za-z0-9_]*$/.test(x)) || new Set(classes).size !== classes.length)) {
      throw new Error("specified test mode requires 1-30 unique Apex test classes.");
    }
    if (tests !== "specified" && classes.length) throw new Error("apex_test_classes requires tests=specified.");
    if (fields.confirm !== "DEPLOY") throw new Error("Deployment requires confirm: DEPLOY.");
    const inputs = {
      source_ref: ref, source_paths: paths.join("\n"), deployment_mode: mode, test_mode: tests,
      apex_test_classes: classes.join("\n"), confirm_deployment: "DEPLOY"
    };
    if (kind === "deploy-and-verify") {
      const scenarios = (fields.scenarios || "").split("\n").map(x => x.trim()).filter(Boolean);
      if (!scenarios.length || scenarios.length > 10 || new Set(scenarios).size !== scenarios.length || scenarios.some(x => !validScenarioPath(x))) {
        throw new Error("Provide 1-10 unique scenario files under tests/browser/.");
      }
      inputs.scenarios_json = JSON.stringify(scenarios);
      inputs.run_description = (fields.description || "AI deploy and browser verification").slice(0, 300);
    }
    return { kind, workflowId: workflows[kind], ref, paths, inputs };
  }
  const runTests = fields.run_local_tests || "false";
  if (!["true", "false"].includes(runTests)) throw new Error("run_local_tests must be true or false.");
  if (fields.confirm !== "RESTORE") throw new Error("Restore requires confirm: RESTORE.");
  return {
    kind, workflowId: workflows[kind], ref, paths,
    inputs: { restore_ref: ref, source_paths: paths.join("\n"), run_local_tests: runTests, confirm_restore: "RESTORE" }
  };
}
