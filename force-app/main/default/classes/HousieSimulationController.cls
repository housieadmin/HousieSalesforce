public with sharing class HousieSimulationController {
    @AuraEnabled
    public static HousieOperationService.OperationResult simulate(String scenario, String payloadJson) {
        HousieSecurity.requireDeveloper();
        HousieErrors.require(new Set<String>{'CREATE_BOARD','CREATE_GAME','BUY_TICKET','BOT_OFFER',
            'START_REQUEST','PAUSE_REQUEST','RESUME_REQUEST','CANCEL_REQUEST','DRAW_NUMBER',
            'SUBMIT_CLAIM','SETTLE_GAME','WALLET_GRANT'}.contains(scenario), 'Unsupported simulation scenario.');
        HousieOperationService.WriteItem item = new HousieOperationService.WriteItem();
        item.objectApiName = 'Audit_Record__b';
        item.fields = new Map<String,Object>{
            'Actor_Account_Id__c' => UserInfo.getUserId(),
            'Scope_Type__c' => 'SIMULATION',
            'Scope_Id__c' => scenario,
            'Action__c' => scenario,
            'Before_State__c' => null,
            'After_State__c' => payloadJson,
            'Reason__c' => 'Developer simulation request',
            'Created_At__c' => System.now()
        };
        return HousieOperationService.commit('SIMULATION_' + scenario, new List<HousieOperationService.WriteItem>{item});
    }
}
