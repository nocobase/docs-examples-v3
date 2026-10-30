# ITAM Lite system design

This is the system design document of ITAM Lite and the basis for every later request. When a request conflicts with it, change this document first, then the code.

## 1. Goals

The company has about 50 people, and its IT devices are kept in a shared spreadsheet: who has which computer and which one is in repair can only be found by digging through chat history. ITAM Lite has to do three things:

1. Every device has one record, so you always know where it is, who uses it and what state it is in.
2. Employees request devices in the system; requests that need approval go through approval, and the register updates itself when a device is issued.
3. Everyone sees and does only what they should, enforced on the server, not just by hiding buttons.

## 2. Roles

| Role                 | Who                                   | Main work                                                                                                          |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Employee             | Everyone in the company               | Submit device requests, view their own requests and the devices assigned to them, withdraw requests not yet issued |
| IT support           | First-line staff in the IT department | Maintain the device register, issue devices for approved requests                                                  |
| Asset manager        | The person in IT who owns assets      | See all devices and requests, approve the requests that need approval, delete devices                              |
| System administrator | The initial administrator account     | Manage users, roles and permissions, adjust workflow parameters                                                    |

One person can have several roles; for example, IT support staff are employees too.

## 3. Core objects

### Device

| Field         | Description                                                 | Rule                                                                            |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Asset tag     | The tag stuck on the device, such as `IT-2026-0001`         | Required, unique across the system, at most 40 characters                       |
| Name          | Model or name, such as `MacBook Pro 14 M4`                  | Required, at most 120 characters                                                |
| Category      | Laptop, Desktop, Monitor, Phone, Accessory                  | Required, one of the five                                                       |
| Serial number | The manufacturer's serial number                            | Optional; unique across the system when filled in (added after the first trial) |
| Status        | In stock, In use, In repair, Retired                        | Required, In stock by default for a new device                                  |
| Assigned to   | The user currently using this device                        | Required when the status is In use; must be empty in any other status           |
| Location      | Office, floor or storeroom, such as `Shanghai 3F storeroom` | Optional, at most 120 characters                                                |
| Purchase date |                                                             | Optional                                                                        |
| Notes         |                                                             | Optional, at most 2000 characters                                               |

### Device request

| Field            | Description                            | Rule                                                                             |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| Requester        | The user who submits the request       | Filled in by the system as the current user; nobody can request for someone else |
| Category         | The category of device wanted          | Required, same as the device categories                                          |
| Reason           | Why it is needed                       | Required, at most 500 characters                                                 |
| Needed by        | The day the requester wants the device | Optional; cannot be earlier than the day it is submitted (added in chapter 9)    |
| Status           | See the workflow below                 | Changed only by the workflow                                                     |
| Approval         | Worked out by the rules on submission  | Filled in by the system                                                          |
| Decision comment | Required when rejecting                |                                                                                  |
| Issued device    | Chosen by IT support when issuing      | Required when issuing                                                            |

## 4. Request workflow

```text
            Submit (needs approval)                 Approve
  Employee ──────────────────▶ Pending approval ───────────▶ Ready to issue ──── Issue ───▶ Issued
     │                              │                               ▲
     │                              └── Reject ──▶ Rejected         │
     └──────── Submit (no approval needed) ─────────────────────────┘
  While Pending approval or Ready to issue, the requester can withdraw ──▶ Withdrawn
```

Rules:

1. **When approval is needed.** When either holds: the requested category is in "Categories that need approval" (by default Laptop and Phone); or the devices in use assigned to the requester have already reached "Devices a person may use without approval" (2 by default). Both are workflow parameters that the system administrator can adjust in "Workflow management"; a change affects only requests submitted afterwards.
2. **Who approves.** Anyone with the Asset manager role can approve, but not a request they submitted themselves. Rejecting requires a decision comment.
3. **Who issues.** Someone with the IT support role picks one device that is In stock and of the same category and issues it. Issuing sets the device's status to In use and its user to the requester, in the same transaction as the request's status change.
4. **Withdrawing.** The requester can withdraw a request that is Pending approval or Ready to issue. Issued and Rejected requests cannot change any more.
5. **History.** Every status change records who did what and when, visible in the request details.

### Notifications

Send in-app messages with Core's notification plugin; opening one goes straight to the request details.

| When                    | Who is notified                                                   |
| ----------------------- | ----------------------------------------------------------------- |
| Enters Pending approval | All asset managers (except the requester)                         |
| Enters Ready to issue   | All IT support staff; the requester (if it went through approval) |
| Rejected                | The requester, with the decision comment                          |
| Issued                  | The requester, with the device's asset tag                        |

A failure to send an in-app message does not affect the request itself; failures can be seen in the executions of Workflow management.

## 5. Pages

| Page                                           | Who can open it                     | Content                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Devices                                        | Employee, IT support, Asset manager | The device list: search by asset tag, name or serial number, filter by status and category; creating, editing and deleting are shown according to permissions. Employees see only the devices assigned to them |
| Device requests                                | Employee, IT support, Asset manager | The request list (including Needed by) and "New request"; the details show the workflow progress, the actions available and the history. Employees see only their own requests                                 |
| Inbox                                          | Every signed-in user                | Comes with the template                                                                                                                                                                                        |
| System settings › Users, Roles and permissions | System administrator                | Comes with the template; assigns roles to users                                                                                                                                                                |
| System settings › Workflow management          | System administrator                | The request workflow's diagram, parameters and executions                                                                                                                                                      |

## 6. Permissions

|                         | Employee               | IT support | Asset manager          |
| ----------------------- | ---------------------- | ---------- | ---------------------- |
| View devices            | Those assigned to them | All        | All                    |
| Create and edit devices | No                     | Yes        | Yes                    |
| Delete devices          | No                     | No         | Yes                    |
| Submit device requests  | Yes                    | Yes        | Yes                    |
| View device requests    | Their own              | All        | All                    |
| Approve                 | No                     | No         | Yes (except their own) |
| Issue                   | No                     | Yes        | No                     |

Every restriction is enforced on the server: lists and details are filtered by data scope, and calling the API directly beyond one's permissions returns 403 or 404. Pages hide buttons according to the same result only for convenience.

## 7. Design guidelines

The company has no design guidelines of its own and follows the ones built into NocoBase 3: shadcn/ui components, the template's theme tokens, and standard lists, forms and drawers. Colors and fonts are not changed separately. The interface is available in Chinese and English.

## 8. Scope

This version includes: the device register, device requests and approval, in-app notifications, the three business roles and their permissions, and workflow management.

This version excludes: purchasing, repairs, stocktaking, retirement, software licenses, device returns, multi-level approval, departments and organization structure, import and export, MDM sync, and AI assistants. Raise a separate request when they are needed.

## 9. Delivery steps and acceptance

| Step                    | Delivers                                                                | Done when                                                                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Device register       | The device table, API and page                                          | An administrator can create, edit and search devices and filter them by status and category; a duplicate asset tag or serial number is reported next to its input; the data is still there after a refresh                                                                                      |
| 2 Requests and approval | The request table, request workflow, notifications, Workflow management | A Laptop request goes to Pending approval, and after an asset manager approves it IT support issues a device, which then shows In use in the register with the requester as its user; a Monitor request goes straight to Ready to issue; at each step the people involved get an in-app message |
| 3 Roles and permissions | The three roles and their data scopes                                   | Signing in with an account of each of the three roles, what each sees and can do matches section 6; an employee calling the approve, issue or edit-device API directly is refused                                                                                                               |
