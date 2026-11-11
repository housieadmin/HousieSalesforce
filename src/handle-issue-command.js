import { parseIssueCommand } from "./parse-issue-command.js";
import { dispatchGitHubWorkflow } from "./dispatch-github-workflow.js";
import { postIssueComment } from "./post-issue-comment.js";

export function handleIssueCommand(env = process.env) {
  const [owner, repository] = String(env.GITHUB_REPOSITORY || "").split("/");
  const issueNumber = Number(env.GITHUB_ISSUE_NUMBER);
  try {
    const request = parseIssueCommand(env.COMMENT_BODY, env.COMMENT_AUTHOR_ASSOCIATION);
    dispatchGitHubWorkflow({ owner, repository, workflowId: request.workflowId, inputs: request.inputs });
    postIssueComment({
      owner, repository, issueNumber,
      body: "Salesforce command dispatched: /sf " + request.kind + ".\nWorkflow: https://github.com/" +
        owner + "/" + repository + "/actions/workflows/" + request.workflowId
    });
    return request;
  } catch (error) {
    const message = String(error?.message || error).replace(/[\r\n]+/g, " ").slice(0, 500);
    if (owner && repository && Number.isInteger(issueNumber) && issueNumber > 0) {
      try { postIssueComment({ owner, repository, issueNumber, body: "Salesforce command rejected. " + message }); } catch {}
    }
    throw error;
  }
}
