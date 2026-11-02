public with sharing class HousieGameService {
    public class GameCommand {
        @AuraEnabled public String accountId;
        @AuraEnabled public String boardId;
        @AuraEnabled public String gameId;
        @AuraEnabled public String action;
        @AuraEnabled public String payloadJson;
    }
    @AuraEnabled
    public static HousieOperationService.OperationResult submitCommand(GameCommand command) {
        HousieErrors.require(command != null && String.isNotBlank(command.action), 'Invalid game command.');
        Housie_Account__c actor = HousieSecurity.requireAccount(command.accountId);
        Map<String,Object> eventPayload = new Map<String,Object>{
            'action' => command.action, 'payload' => command.payloadJson,
            'boardId' => command.boardId, 'gameId' => command.gameId
        };
        HousieOperationService.WriteItem eventWrite = new HousieOperationService.WriteItem();
        eventWrite.objectApiName = 'Game_Event__b';
        eventWrite.fields = new Map<String,Object>{
            'Game_Id__c' => command.gameId,
            'Sequence__c' => System.now().getTime(),
            'Event_Type__c' => 'COMMAND_RECEIVED',
            'Actor_Account_Id__c' => actor.Account_Key__c,
            'Payload__c' => JSON.serialize(eventPayload),
            'Created_At__c' => System.now()
        };
        return HousieOperationService.commit('GAME_COMMAND_' + command.action, new List<HousieOperationService.WriteItem>{eventWrite});
    }
}
