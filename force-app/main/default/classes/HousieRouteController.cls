public without sharing class HousieRouteController {
    public class RouteContext {
        @AuraEnabled public String route;
        @AuraEnabled public String token;
        @AuraEnabled public String accountKey;
        @AuraEnabled public String accountName;
        @AuraEnabled public Boolean authenticated;
    }
    @AuraEnabled
    public static RouteContext resolve(String token) {
        RouteContext ctx = new RouteContext();
        ctx.route = 'home';
        ctx.token = token;
        ctx.authenticated = false;
        if (String.isBlank(token)) return ctx;
        // Tokens are treated as opaque lookup secrets, never as record IDs.
        List<Housie_Account__c> rows = [
            SELECT Account_Key__c, Display_Name__c, Status__c
            FROM Housie_Account__c WHERE Account_Key__c = :token LIMIT 1
        ];
        if (!rows.isEmpty() && rows[0].Status__c == 'ACTIVE') {
            ctx.accountKey = rows[0].Account_Key__c;
            ctx.accountName = rows[0].Display_Name__c;
            ctx.authenticated = true;
            ctx.route = 'account';
        }
        return ctx;
    }
}
