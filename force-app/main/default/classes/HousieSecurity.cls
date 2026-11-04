public without sharing class HousieSecurity {
    public static Housie_Account__c requireAccount(String accountId) {
        HousieErrors.require(String.isNotBlank(accountId), 'Account context is required.');
        List<Housie_Account__c> rows = [
            SELECT Id, Account_Key__c, Email__c, Display_Name__c, Platform_Role__c,
                   Points_Balance__c, Reserved_Points__c, Auto_Mode_Tokens__c, Flips__c,
                   Fixes__c, Status__c
            FROM Housie_Account__c WHERE Account_Key__c = :accountId LIMIT 1
        ];
        HousieErrors.require(!rows.isEmpty(), 'Account not found.');
        HousieErrors.require(rows[0].Status__c == 'ACTIVE', 'Account is not active.');
        return rows[0];
    }
    public static Boolean isSuperAdmin(Housie_Account__c a) {
        return a != null && a.Platform_Role__c == 'PLATFORM_SUPER_ADMIN';
    }
    public static void requireSuperAdmin() {
        HousieErrors.require(FeatureManagement.checkPermission('HOUSIE_SUPER_ADMIN'),
            'Platform super-admin permission required.');
    }
    public static void requireDeveloper() {
        HousieErrors.require(FeatureManagement.checkPermission('HOUSIE_DEVELOPER'),
            'Developer simulation permission required.');
    }
}