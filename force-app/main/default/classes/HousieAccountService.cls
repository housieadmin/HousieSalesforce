public with sharing class HousieAccountService {
    @AuraEnabled
    public static Housie_Account__c createAccount(String email, String displayName) {
        HousieSecurity.requireSuperAdmin();
        HousieOperationService.lockForWrite();

        String normalizedEmail = String.isBlank(email) ? null : email.trim().toLowerCase();
        HousieErrors.require(String.isNotBlank(normalizedEmail), 'Email is required.');
        HousieErrors.require(normalizedEmail.length() <= 80, 'Email cannot exceed 80 characters.');
        HousieErrors.require(Pattern.matches('^[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}$',
            normalizedEmail.toUpperCase()), 'Enter a valid email address.');
        List<Housie_Account__c> existingAccounts = [
            SELECT Id FROM Housie_Account__c WHERE Email__c = :normalizedEmail LIMIT 1
        ];
        HousieErrors.require(existingAccounts.isEmpty(), 'An account with this email already exists.');

        String safeName = String.isBlank(displayName) ? normalizedEmail : displayName.trim();
        HousieErrors.require(safeName.length() <= 80, 'Display name cannot exceed 80 characters.');

        Datetime nowAt = System.now();
        Housie_Account__c account = new Housie_Account__c(
            Name = safeName,
            Account_Key__c = HousieIds.newId(),
            Email__c = normalizedEmail,
            Display_Name__c = safeName,
            Platform_Role__c = 'ACCOUNT',
            Points_Balance__c = 100,
            Reserved_Points__c = 0,
            Auto_Mode_Tokens__c = 1,
            Flips__c = 1,
            Fixes__c = 1,
            Status__c = 'PENDING_SETUP',
            Created_At__c = nowAt,
            Updated_At__c = nowAt
        );
        // This request performs ordinary DML only. The LWC calls initializeAccount
        // as a second Apex request after this transaction has committed.
        insert account;
        return account;
    }

    @AuraEnabled
    public static Housie_Account__c initializeAccount(String accountKey) {
        HousieSecurity.requireSuperAdmin();
        HousieOperationService.lockForWrite();

        List<Housie_Account__c> rows = [
            SELECT Id, Account_Key__c, Display_Name__c, Status__c, Updated_At__c
            FROM Housie_Account__c
            WHERE Account_Key__c = :accountKey
            LIMIT 1
            FOR UPDATE
        ];
        HousieErrors.require(!rows.isEmpty(), 'Account not found.');
        Housie_Account__c account = rows[0];
        if (account.Status__c == 'ACTIVE') return account;
        HousieErrors.require(account.Status__c == 'PENDING_SETUP',
            'Only an account pending setup can be initialized.');

        List<HousieOperationService.WriteItem> grants = new List<HousieOperationService.WriteItem>{
            resourceGrant(account.Account_Key__c, 'POINTS', 100, 'SIGNUP_POINTS'),
            resourceGrant(account.Account_Key__c, 'AUTO_MODE_TOKEN', 1, 'SIGNUP_AUTO_MODE'),
            resourceGrant(account.Account_Key__c, 'FLIP', 1, 'SIGNUP_FLIP'),
            resourceGrant(account.Account_Key__c, 'FIX', 1, 'SIGNUP_FIX')
        };
        // All Big Object callouts happen before the activation DML below.
        HousieOperationService.executeOperation('ACCOUNT_SIGNUP_GRANTS', grants);

        account.Status__c = 'ACTIVE';
        account.Updated_At__c = System.now();
        update account;
        return account;
    }

    private static HousieOperationService.WriteItem resourceGrant(
        String accountKey, String resourceType, Decimal quantity, String grantKey
    ) {
        HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
        item.objectApiName = 'Account_Resource_Transaction__b';
        item.fields = new Map<String,Object>{
            'Record_Id__c' => HousieIds.stableId('ACCOUNT_GRANT', accountKey + ':' + grantKey),
            'Account_Id__c' => accountKey,
            'Resource_Type__c' => resourceType,
            'Transaction_Type__c' => 'GRANT',
            'Quantity__c' => quantity,
            'Source_Type__c' => 'SIGNUP',
            'Source_Id__c' => accountKey,
            'Idempotency_Key__c' => HousieIds.stableId('ACCOUNT_GRANT', accountKey + ':' + grantKey),
            'Created_At__c' => System.now(),
            'Metadata__c' => JSON.serialize(new Map<String,Object>{'reason' => 'Initial account signup grant'})
        };
        return item;
    }
}