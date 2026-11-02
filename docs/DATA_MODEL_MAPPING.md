# Logical model to Salesforce storage

| Logical entity | Salesforce storage | Notes |
|---|---|---|
| accounts | Housie_Account__c | Custom object; balances are projections, ledger is audit authority |
| account_resource_transactions | Account_Resource_Transaction__b | Immutable ledger |
| wallet_holds | Wallet_Hold__b | Hold lifecycle snapshots |
| boards | Board__b | Board configuration |
| board_members | Board_Member__b | Membership |
| games | Game__b | Game snapshot and cached wallet projections |
| game_participants | Game_Participant__b | Human ticket owners only |
| tickets | Ticket__b | Human and bot ticket layout/marks |
| bot_contributions | Bot_Contribution__b | Accepted and proposed contributions |
| game_events | Game_Event__b | Ordered authoritative stream |
| claims | Claim__b | First-class claims |
| game_action_requests | Game_Action_Request__b | Open action requests |
| game_action_responses | Game_Action_Response__b | Votes/responses |
| game_ledger | Game_Ledger__b | Immutable game accounting |
| chat_messages | Chat_Message__b | Board/game chat |
| audit_records | Audit_Record__b | Sensitive actions |
| technical operation journal | Operation_Journal__b | Added infrastructure record for fail-closed operation visibility |

Every Big Object has a `Record_Id__c` and `Operation_Id__c`. Business fields from the logical schema are retained as explicit metadata fields; structured snapshots and flexible payloads use LongTextArea JSON fields where the schema calls for compact structured data.
