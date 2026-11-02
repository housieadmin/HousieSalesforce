@IsTest
private class HousieDomainRulesTest {
    @IsTest static void availablePointsNeverNegative() {
        Housie_Account__c a = new Housie_Account__c(Points_Balance__c=100, Reserved_Points__c=25);
        System.assertEquals(75, HousieDomainRules.availablePoints(a));
    }
    @IsTest static void deterministicIdsAreStable() {
        String one = HousieIds.deterministicId('op-1', 2);
        String two = HousieIds.deterministicId('op-1', 2);
        System.assertEquals(one, two);
        System.assertEquals(32, one.length());
    }
    @IsTest static void equalSharesReconcile() {
        Decimal[] shares = HousieDomainRules.equalShares(10, 3);
        System.assertEquals(10, shares[0] + shares[1] + shares[2]);
    }
}
