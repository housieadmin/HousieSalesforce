public without sharing class HousieBigObjectStore {
    private static final Set<String> ALLOWED = new Set<String>{
        'Account_Resource_Transaction__b','Wallet_Hold__b','Board__b','Board_Member__b',
        'Game__b','Game_Participant__b','Ticket__b','Bot_Contribution__b','Game_Event__b',
        'Claim__b','Game_Action_Request__b','Game_Action_Response__b','Game_Ledger__b',
        'Chat_Message__b','Audit_Record__b'
    };
    public static Database.SaveResult insertOne(String objectApiName, Map<String,Object> values) {
        HousieErrors.require(ALLOWED.contains(objectApiName), 'Unsupported Big Object.');
        return insertRaw(objectApiName, values);
    }
    public static Database.SaveResult writeJournal(Map<String,Object> values) {
        return insertRaw('Operation_Journal__b', values);
    }
    private static Database.SaveResult insertRaw(String objectApiName, Map<String,Object> values) {
        Schema.SObjectType token = Schema.getGlobalDescribe().get(objectApiName);
        HousieErrors.require(token != null, 'Big Object metadata is not deployed: ' + objectApiName);
        SObject row = token.newSObject();
        Map<String,Schema.SObjectField> fields = token.getDescribe().fields.getMap();
        for (String key : values.keySet()) {
            HousieErrors.require(fields.containsKey(key), 'Unknown field: ' + key);
            row.put(key, values.get(key));
        }
        Database.SaveResult result = Database.insertImmediate(row);
        if (!result.isSuccess()) {
            List<String> messages = new List<String>();
            for (Database.Error e : result.getErrors()) messages.add(e.getStatusCode() + ': ' + e.getMessage());
            throw new HousieErrors.HousieException(String.join(messages, '; '));
        }
        return result;
    }
    public static Boolean isCommitted(String operationId) {
        if (String.isBlank(operationId)) return false;
        List<Operation_Journal__b> rows = [
            SELECT Status__c
            FROM Operation_Journal__b
            WHERE Operation_Id__c = :operationId
            LIMIT 1
        ];
        return !rows.isEmpty() && rows[0].Status__c == 'COMMITTED';
    }

    public static Set<String> committedOperationIds(Set<String> operationIds) {
        Set<String> committed = new Set<String>();
        if (operationIds == null || operationIds.isEmpty()) return committed;
        List<Operation_Journal__b> rows = [
            SELECT Operation_Id__c, Status__c
            FROM Operation_Journal__b
            WHERE Operation_Id__c IN :operationIds
            LIMIT 2000
        ];
        for (Operation_Journal__b row : rows) {
            if (row.Status__c == 'COMMITTED') committed.add(row.Operation_Id__c);
        }
        return committed;
    }

    public static List<SObject> queryByLeadingKeys(String objectApiName, Map<String,Object> keyValues, Integer rowLimit) {
        HousieErrors.require(ALLOWED.contains(objectApiName), 'Unsupported Big Object.');
        List<String> clauses = new List<String>();
        for (String key : keyValues.keySet()) clauses.add(key + ' = :' + key);
        // Build a bind-safe query using a map of named bind variables.
        String soql = 'SELECT Record_Id__c, Operation_Id__c FROM ' + objectApiName + ' WHERE ' +
            String.join(clauses, ' AND ') + ' LIMIT ' + String.valueOf(Math.min(Math.max(rowLimit,1),2000));
        return Database.queryWithBinds(soql, keyValues, AccessLevel.SYSTEM_MODE);
    }
}