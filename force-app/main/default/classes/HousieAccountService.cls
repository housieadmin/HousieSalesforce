public with sharing class HousieAccountService {
    public class AccountInput {
        @AuraEnabled public String email;
        @AuraEnabled public String displayName;
    }
    @AuraEnabled
    public static Housie_Account__c createAccount(AccountInput input) {
        HousieSecurity.requireSuperAdmin();
        HousieErrors.require(input != null && String.isNotBlank(input.email), 'Email is required.');
        Housie_Account__c a = new Housie_Account__c();
        a.Name = String.isBlank(input.displayName) ? input.email : input.displayName.trim();
        a.Account_Key__c = HousieIds.newId();
        a.Email__c = input.email.trim().toLowerCase();
        a.Display_Name__c = String.isBlank(input.displayName) ? input.email : input.displayName.trim();
        a.Platform_Role__c = 'ACCOUNT';
        a.Points_Balance__c = 100;
        a.Reserved_Points__c = 0;
        a.Auto_Mode_Tokens__c = 1;
        a.Flips__c = 1;
        a.Fixes__c = 1;
        a.Status__c = 'ACTIVE';
        a.Created_At__c = System.now();
        a.Updated_At__c = System.now();
        insert a;
        return a;
    }
}
