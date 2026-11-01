#!/usr/bin/env python3
"""
Fetch Jira test case data for UiPath-to-Playwright migration workflows.
Supports fetching from Jira REST API if credentials are configured,
or returning structured fallback test case data for migration tickets.
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error

def fetch_from_jira_api(ticket_id):
    jira_url = os.environ.get("JIRA_URL")
    jira_token = os.environ.get("JIRA_API_TOKEN")
    jira_user = os.environ.get("JIRA_USER", "")

    if not jira_url or not jira_token:
        return None

    api_url = f"{jira_url.rstrip('/')}/rest/api/2/issue/{ticket_id}"
    req = urllib.request.Request(api_url)
    auth_header = f"Bearer {jira_token}"
    req.add_header("Authorization", auth_header)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                raw_data = json.loads(response.read().decode())
                return parse_jira_issue(raw_data)
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to query Jira REST API: {e}\n")
        return None

def parse_jira_issue(raw_issue):
    fields = raw_issue.get("fields", {})
    return {
        "ticketId": raw_issue.get("key"),
        "summary": fields.get("summary", ""),
        "description": fields.get("description", ""),
        "components": [c.get("name") for c in fields.get("components", [])],
        "labels": fields.get("labels", []),
    }

def get_predefined_ticket_data(ticket_id):
    """
    Returns standard structured test case data for UiPath to Playwright migration.
    """
    target_url = os.environ.get("TARGET_URL") or os.environ.get("APP_URL", "/")
    return {
        "ticketId": ticket_id,
        "summary": "Migrate UiPath Web Journey to Playwright TypeScript",
        "legacyWorkflow": "UiPath_Web_UserJourney.xaml",
        "targetUrl": target_url,
        "description": "Legacy UiPath test suite validates web navigation, hero banner actions, and interactive elements.",
        "testSteps": [
            {
                "stepNumber": 1,
                "action": "Navigate to Application Home Page",
                "type": "navigate",
                "targetComponent": "Page Root",
                "targetSelector": "page.goto('/')",
                "expectedResult": "Page loads with layout components visible."
            },
            {
                "stepNumber": 2,
                "action": "Verify and click navigation menu item 'Adventures'",
                "type": "click",
                "targetComponent": "nav",
                "targetSelector": "nav a",
                "ariaRole": "navigation",
                "roleType": "link",
                "name": "Adventures",
                "expectedResult": "Navigation item is interactive and navigates successfully."
            },
            {
                "stepNumber": 3,
                "action": "Validate Hero Banner CTA",
                "type": "click",
                "targetComponent": "banner",
                "targetSelector": "a.cta-button",
                "ariaRole": "link",
                "roleType": "link",
                "name": "Explore Adventures",
                "expectedResult": "Hero CTA button is visible and actionable."
            },
            {
                "stepNumber": 4,
                "action": "Click Hero CTA and verify destination title",
                "type": "click",
                "targetComponent": "heading",
                "targetSelector": "h1",
                "expectedResult": "Target title heading displays correctly."
            }
        ],
        "assertions": [
            {
                "component": "header",
                "condition": "toBeVisible",
                "description": "Global navigation header is visible"
            },
            {
                "component": "main",
                "condition": "toBeVisible",
                "description": "Main application content renders"
            }
        ]
    }

def main():
    parser = argparse.ArgumentParser(description="Fetch Jira test case data for migration (Optional)")
    parser.add_argument("--ticket", required=False, default=None, help="Optional Jira ticket ID (e.g. JIRA-12345)")
    args = parser.parse_args()

    if args.ticket:
        # Try live Jira API if available
        data = fetch_from_jira_api(args.ticket)
        if not data:
            data = get_predefined_ticket_data(args.ticket)
    else:
        # Generic test case mode without Jira ticket
        data = {
            "ticketId": None,
            "summary": "Generic web journey migration",
            "legacyWorkflow": "UiPath_Generic_Web_Workflow.xaml",
            "targetUrl": os.environ.get("APP_URL", "/"),
            "description": "Generic migration of a UiPath web user flow to Playwright TypeScript.",
            "testSteps": [
                {
                    "stepNumber": 1,
                    "action": "Navigate to application home page",
                    "type": "navigate",
                    "targetComponent": "Page Root",
                    "targetSelector": "page.goto('/')",
                    "expectedResult": "Page loads successfully."
                },
                {
                    "stepNumber": 2,
                    "action": "Verify and click navigation item",
                    "type": "click",
                    "targetComponent": "nav",
                    "targetSelector": "header nav a",
                    "roleType": "link",
                    "name": "Featured",
                    "expectedResult": "Navigation item is interactive."
                },
                {
                    "stepNumber": 3,
                    "action": "Validate main action button",
                    "type": "click",
                    "targetComponent": "main",
                    "targetSelector": "button, a[role='button']",
                    "roleType": "button",
                    "name": "Continue",
                    "expectedResult": "Primary action control is visible and actionable."
                }
            ],
            "assertions": [
                {
                    "component": "header",
                    "condition": "toBeVisible",
                    "description": "Global navigation header is visible"
                },
                {
                    "component": "main",
                    "condition": "toBeVisible",
                    "description": "Main application content renders"
                }
            ]
        }

    # Output pure JSON to stdout
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
