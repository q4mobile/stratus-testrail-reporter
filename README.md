<p align="center">
    <img width="600" alt="Stratus Tools" src="https://i.imgur.com/gXvZKYB.png">
</p>
<p align="center">A custom Github Action that consumes Stratus test reports to create and execute TestRail runs</p>

---

[![Build](https://github.com/q4mobile/stratus-testrail-reporter/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/q4mobile/stratus-testrail-reporter/actions/workflows/build.yml)

# Stratus TestRail Reporter

This action is designed to provide a test case coverage report through the following:
- When target branch is not "staging", create a new self-closing Test Run in TestRail
- When target branch is "staging", create or re-use a Milestone to create a new Test Plan in Testrail
- Upload the results of test suites ran by Jest or Nightwatch to TestRail
  - Use the [Stratus Jest Reporter](https://github.com/q4mobile/stratus-jest-reporter) or the [Stratus Nightwatch Reporter](https://github.com/q4mobile/stratus-nightwatch-reporter) to generate results easily!

## Prerequisites

This action assumes that a report file or files have already been generated in JSON format
with the following structure:

```JSON
[
    {
        "case_id": 905000,
        "status_id": 1,
        "comment": "Test passed successfully."
    }
]
```
Where:
- `case_id` is the TestRail Test Case ID
- `status_id` is the result of the Test Case

## Inputs

##### `target_branch`
The target GitHub branch (if action is triggered by pull request).
This is used to determine weather or not the reporter should run in regression mode. Ex: `develop` or `staging`.

##### `network_url` (**Required**)
The TestRail account domain name. Ex: `https://<YourProjectURL>.testrail.com`.

##### `username` (**Required**)
The username associated with the test runner. Usually an email address.

##### `api_key` (**Required**)
The API key associated with the username.

##### `project_id` (**Required**)
The project ID of the TestRail project.

##### `suite_id` (**Required**)
The suite ID of the TestRail project. Does not include "S" prefix.

##### `report_files` (**Required**)
One or more files (multi-line input) to parse and report to TestRail.

##### `regression_branch` (**Optional**)
This sets regression branch used to determine weather or not the reporter should run in regression mode. Default: `staging`.

## Outputs

##### `run_id`
The id of TestRail run created in the action.

##### `completion_time`
A string to represent the time when the TestRail run completed in the action.

## Example usage

```yml
- name: Prepare Test Results File for TestRail
  run: npm run test

- name: Report to TestRail
  uses: q4mobile/stratus-testrail-reporter@v1
  with:
    target_branch: ${{ github.base_ref }}
    regression_branch: test ## optional (Default: `staging`)
    network_url: ${{ secrets.TESTRAIL_NETWORK_URL }}
    username: ${{ secrets.TESTRAIL_USER_EMAIL }}
    api_key: ${{ secrets.TESTRAIL_API_KEY }}
    project_id: 26
    suite_id: 11417
    report_files: |
      client-testrail-report.json
      backend-testrail-report.json
```

## Development

### Building the action

To work locally, typescript code needs to be built and committed. Run the following command and commit all changes as usual:
```shell
npm run all
```