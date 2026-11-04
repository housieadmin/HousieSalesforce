# Historical deployment errors and source corrections

Source: a deployment output supplied during initial development (`deploy_errors.txt`, 51 reported errors). The original report is not a current release checklist. This document preserves the root-cause mapping for future reference.

| Reported error group | Root cause | Source correction |
|---|---|---|
| `HousieOperationService.cls` parser errors at `commit`, plus undefined `writes` cascade | `commit` is reserved in Apex parsing in this context; subsequent parse failures made the method body invalid | Renamed the public Apex method to `executeOperation`; removed Aura exposure from the generic writer |
| `HousieGameService` / `HousieSimulationController` cannot find `commit` | Callers still used the old method name | Updated both callers to `executeOperation` |
| `HousieBigObjectStore.cls: Operation_Id__c can not be filtered` | Big Object index metadata had not deployed correctly, and the query path depended on that index | Added required Big Object index metadata names; journal reads filter on the journal's leading `Operation_Id__c` index field. Added bulk committed-operation lookup using `IN` on that indexed field |
| 16 errors: `element fullName missing for a child of type Index` | Big Object `indexes` metadata omitted the index `fullName` | Added `<fullName>Primary_Query_Index</fullName>` to each Big Object index |
| Duplicate `Operation_Journal__b.Operation_Id__c` | The journal metadata declared the same field twice | Removed the duplicate declaration |
| 11 LongTextArea errors requiring `visibleLines` | Big Object LongTextArea custom fields omitted required display metadata | Added `<visibleLines>5</visibleLines>` to every LongTextArea field |
| `Housie_Accounts.tab-meta.xml` master label error | The custom tab file name did not match the custom object API name | Replaced it with `Housie_Account__c.tab-meta.xml` |
| Cascading LWC and PermissionSet errors for missing Apex classes | Their Apex dependencies did not compile because of earlier parser errors | Fixed the Apex compiler blockers and aligned the board-service class access entries |

## Additional metadata and query corrections

- `Ticket__b.Owner_Account_Id__c` is nullable because bot tickets have no human owner. It was removed from the ticket primary index so BOT tickets can have a null owner.
- Board queries use `(Visibility__c, Record_Id__c)` so public boards can be enumerated while both public and private boards remain resolvable by ID. `Visibility__c` is required because it is an index field. Board Member listing is keyed by `Account_Id__c`.
- The board-list path bulk-loads journal commit states instead of issuing one SOQL query for each membership, board and game record.
- The public Experience permission set grants Apex access to `HousieRouteController`, `HousieBoardService` and `HousieGameTicketService`; it grants no direct account-object read or admin/simulation access.
- The owner account bearer key is no longer returned in board-list results or required for board join/leave. The random board ID is the private invite token.
- Board membership transitions are written as immutable Big Object versions and the latest committed transition is treated as the current logical membership. This preserves the previous committed state if an update fails before its journal commit.

## Later validation evidence

The source corrections were subsequently included in the repository state that passed PR metadata dry-run validation in [PR #24 validation run #41770869570](https://github.com/housieadmin/HousieSalesforce/actions/runs/41770869570). The PR workflow also completed its `RunLocalTests` step against tests already deployed in the Developer Edition; it does not execute branch-only test classes.

The targeted deployment [run #41760108157](https://github.com/housieadmin/HousieSalesforce/actions/runs/41760108157) deployed four selected transaction-boundary Apex classes. It was not a full wildcard deployment of every metadata correction listed above. Do not describe that targeted deployment as proof that every listed metadata member was separately deployed.
