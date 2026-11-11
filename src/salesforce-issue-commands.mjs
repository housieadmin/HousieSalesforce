import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workflows = {
  deploy: "salesforce-ai-iteration-deploy.yml",
  "deploy-and-verify": "salesforce-deploy-and-verify.yml",
  restore: "salesforce-ai-iteration-restore.yml",
  retrieve: "salesforce-org-sync.yml"
};

export function parseIssueCommand(body, authorAssociation = "OWNER") {
  if (authorAssociation !== "OWNER") throw new Error("Only repository owners may run Salesforce commands.");
  const lines = String(body || "").split(/\r?\n/).map(line => line.trim());
  const command = lines[0];
  if (!Object.hasOwn(workflows, command.replace("/sf ", "")) || !command.startsWith("/sf ")) {
    throw new Error("Supported commands are /sf deploy, /sf deploy-and-verify, /sf restore and /sf retrieve.");
  }
  const kind = command.slice(4);
  const isRetrieve = kind === "retrieve";
  const isDeploy = kind === "deploy" || kind === "deploy-and-verify";
  const allowed = isRetrieve
    ? new Set(["paths", "create_pr", "description"])
    : isDeploy
      ? new Set(["ref", "paths", "mode", "tests", "apex_test_classes", "scenarios", "description", "confirm"])
      : new Set(["ref", "paths", "run_local_tests", "confirm"]);
  const fields = {};
  let listField = null;
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      if (!allowed.has(key) || Object.hasOwn(fields, key)) throw new Error("Unknown or duplicate field: " + key);
      fields[key] = match[2];
      listField = ["paths", "apex_test_classes", "scenarios"].includes(key) ? key : null;
      if (listField && fields[key] !== "") throw new Error("Use a list under " + key + ": with one '- value' per line.");
      continue;
    }
    if (line.startsWith("- ") && listField) {
      fields[listField] += (fields[listField] ? "\n" : "") + line.slice(2).trim();
      continue;
    }
    throw new Error("Unexpected command line. Use key: value fields and dash-prefixed list items.");
  }
  const paths = (fields.paths || "").split("\n").map(value => value.trim()).filter(Boolean);
  let workflowId;
  let inputs;
  if (isRetrieve) {
    if (paths.length > 25 || new Set(paths).size !== paths.length) throw new Error("Provide at most 25 unique retrieve paths.");
    const xmlPaths = paths.filter(item => item.endsWith(".xml"));
    if (xmlPaths.length > 1 || (xmlPaths.length && paths.length > 1)) throw new Error("Use either one retrieve manifest XML path or component paths, not both.");
    for (const item of paths) {
      if (item.length > 240 || item.includes("..") || item.includes("//") || item.endsWith("/") ||
        !(/^force-app\/[A-Za-z0-9._/-]+$/.test(item) || /^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(item))) {
        throw new Error("Invalid retrieve path: " + item);
      }
    }
    const createPr = (fields.create_pr || "true").trim();
    if (!["true", "false"].includes(createPr)) throw new Error("create_pr must be true or false.");
    workflowId = workflows.retrieve;
    inputs = {
      confirm_sync: "SYNC",
      retrieve_paths: paths.filter(item => !item.endsWith(".xml")).join("\n"),
      retrieve_manifest: xmlPaths[0] || "manifest/package-retrieve.xml",
      create_pr: createPr,
      run_description: (fields.description || "Issue-comment initiated Salesforce metadata retrieve").slice(0, 300)
    };
  } else {
    const ref = (fields.ref || "").trim();
    if (!ref || ref.length > 200 || ref.startsWith("-") || ref.includes("..") || ref.includes("//") ||
      !/^[A-Za-z0-9._/-]+$/.test(ref)) throw new Error("ref must be an existing branch, tag or commit SHA using safe Git ref characters.");
    if (!paths.length || paths.length > 25 || new Set(paths).size !== paths.length) throw new Error("Provide 1-25 unique paths under force-app/.");
    for (const item of paths) {
      if (item.length > 240 || !/^force-app\/[A-Za-z0-9._/-]+$/.test(item) || item.includes("..") || item.includes("//") || item.endsWith("/")) {
        throw new Error("Invalid metadata path: " + item);
      }
    }
    if (isDeploy) {
      const deploymentMode = (fields.mode || "standard").trim();
      if (!["standard", "fast"].includes(deploymentMode)) throw new Error("mode must be standard or fast.");
      const testMode = (fields.tests || "none").trim();
      if (!["none", "specified", "local"].includes(testMode)) throw new Error("tests must be none, specified or local.");
      if (deploymentMode === "fast" && testMode !== "none") throw new Error("mode: fast requires tests: none.");
      const testClasses = (fields.apex_test_classes || "").split("\n").map(value => value.trim()).filter(Boolean);
      if (testMode === "specified") {
        if (!testClasses.length || testClasses.length > 30 || testClasses.some(value => !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) || new Set(testClasses).size !== testClasses.length) {
          throw new Error("specified test mode requires 1-30 unique Apex test class names.");
        }
      } else if (testClasses.length) throw new Error("apex_test_classes is only valid when tests: specified.");
      if ((fields.confirm || "").trim() !== "DEPLOY") throw new Error("Deployment requires confirm: DEPLOY.");
      workflowId = workflows[kind];
      inputs = {
        source_ref: ref,
        source_paths: paths.join("\n"),
        deployment_mode: deploymentMode,
        test_mode: testMode,
        apex_test_classes: testClasses.join("\n"),
        confirm_deployment: "DEPLOY"
      };
      if (kind === "deploy-and-verify") {
        const scenarios = (fields.scenarios || "").split("\n").map(value => value.trim()).filter(Boolean);
        if (!scenarios.length || scenarios.length > 10 || new Set(scenarios).size !== scenarios.length ||
          scenarios.some(value => !/^browser-agent\/scenarios\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(value) || value.includes("..") || value.includes("//"))) {
          throw new Error("Provide 1-10 unique scenario paths under browser-agent/scenarios/*.spec.ts.");
        }
        inputs.scenarios_json = JSON.stringify(scenarios);
        inputs.run_description = (fields.description || "AI-requested deploy and browser verification").slice(0, 300);
      }
    } else {
      const runTests = (fields.run_local_tests || "false").trim();
      if (!["true", "false"].includes(runTests)) throw new Error("run_local_tests must be true or false.");
      if ((fields.confirm || "").trim() !== "RESTORE") throw new Error("Restore requires confirm: RESTORE.");
      workflowId = workflows.restore;
      inputs = {
        restore_ref: ref,
        source_paths: paths.join("\n"),
        run_local_tests: runTests,
        confirm_restore: "RESTORE"
      };
    }
  }
  const label = isRetrieve ? "Salesforce metadata retrieve" : kind === "deploy-and-verify" ? "AI deploy and browser verification" : kind === "deploy" ? "AI iteration deploy" : "AI iteration restore";
  return { command, kind, workflowId, inputs, label, paths, ref: fields.ref || "" };
}

function gh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    input: input === undefined ? undefined : JSON.stringify(input)
  });
}

export function dispatchIssueCommand(env = process.env) {
  const [owner, repo] = String(env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY is required.");
  const issueNumber = Number(env.GITHUB_ISSUE_NUMBER);
  if (!Number.isInteger(issueNumber) || issueNumber < 1) throw new Error("GITHUB_ISSUE_NUMBER is invalid.");
  const request = parseIssueCommand(env.COMMENT_BODY, env.COMMENT_AUTHOR_ASSOCIATION);
  if (request.ref) gh(["api", "repos/" + owner + "/" + repo + "/commits/" + encodeURIComponent(request.ref)]);
  gh(["api", "-X", "POST", "repos/" + owner + "/" + repo + "/actions/workflows/" + request.workflowId + "/dispatches", "--input", "-"], {
    ref: "main",
    inputs: request.inputs
  });
  const workflowUrl = "https://github.com/" + owner + "/" + repo + "/actions/workflows/" + request.workflowId;
  const details = request.kind === "retrieve"
    ? "- Retrieve selection: " + (request.paths.length ? request.paths.map(value => "`" + value + "`").join(", ") : "`manifest/package-retrieve.xml` (default)") + "\n- Create pull request: " + request.inputs.create_pr
    : "- Requested ref: `" + request.ref + "`\n- Selected paths:\n" + request.paths.map(value => "  - `" + value + "`").join("\n");
  const body = "<strong>" + request.label + " dispatched.</strong>\n\n" + details +
    "\n- Workflow definition: `main`\n\n[Open the workflow runs](" + workflowUrl + ").";
  gh(["api", "-X", "POST", "repos/" + owner + "/" + repo + "/issues/" + issueNumber + "/comments", "--input", "-"], { body });
  return request;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    dispatchIssueCommand();
  } catch (error) {
    const message = String(error?.message || error).replace(/[\r\n]+/g, " ").slice(0, 500);
    const [owner, repo] = String(process.env.GITHUB_REPOSITORY || "").split("/");
    const issueNumber = Number(process.env.GITHUB_ISSUE_NUMBER);
    if (owner && repo && Number.isInteger(issueNumber) && issueNumber > 0) {
      try {
        gh(["api", "-X", "POST", "repos/" + owner + "/" + repo + "/issues/" + issueNumber + "/comments", "--input", "-"], {
          body: "<strong>Salesforce command rejected.</strong> " + message + "\n\nNo successful dispatch was confirmed."
        });
      } catch {}
    }
    console.error(message);
    process.exitCode = 1;
  }
}
