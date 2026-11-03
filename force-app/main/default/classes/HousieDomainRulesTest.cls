@IsTest
private class HousieDomainRulesTest {
    @IsTest static void availablePointsNeverNegative() {
        Housie_Account__c a = new Housie_Account__c(
            Points_Balance__c=100, Reserved_Points__c=25
        );
        System.assertEquals(Decimal.valueOf('75.00'), HousieDomainRules.availablePoints(a));
    }

    @IsTest static void deterministicIdsAreStableAndSizedForBigObjectIndexes() {
        String one = HousieIds.deterministicId('op-1', 2);
        String two = HousieIds.deterministicId('op-1', 2);
        System.assertEquals(one, two);
        System.assertEquals(32, one.length());
    }

    @IsTest static void stableIdsAreDeterministicForNaturalKeys() {
        String first = HousieIds.stableId('BOARD_MEMBER', 'board-1:account-1');
        String second = HousieIds.stableId('BOARD_MEMBER', 'board-1:account-1');
        String different = HousieIds.stableId('BOARD_MEMBER', 'board-2:account-1');
        System.assertEquals(first, second);
        System.assertEquals(false, first == different);
        System.assertEquals(32, first.length());
    }

    @IsTest static void equalSharesReconcileInAcceptanceOrder() {
        Decimal[] shares = HousieDomainRules.equalShares(10, 3);
        System.assertEquals(Decimal.valueOf('3.34'), shares[0]);
        System.assertEquals(Decimal.valueOf('3.33'), shares[1]);
        System.assertEquals(Decimal.valueOf('3.33'), shares[2]);
        System.assertEquals(Decimal.valueOf('10.00'), shares[0] + shares[1] + shares[2]);
    }

    @IsTest static void standardTicketLayoutPassesAllStructuralRules() {
        List<List<Integer>> layout = new List<List<Integer>>{
            new List<Integer>{1, null, 20, 30, null, null, 60, 70, null},
            new List<Integer>{null, 10, null, null, 40, 50, 69, null, 80},
            new List<Integer>{9, null, 29, 39, null, 59, null, 79, null}
        };
        HousieDomainRules.validateTicketLayout(layout);
        System.assertEquals(15, countTicketNumbers(layout));
    }

    @IsTest static void generatedTicketsPassAllStructuralRules() {
        for (Integer attempt = 0; attempt < 30; attempt++) {
            List<List<Integer>> generated = HousieTicketGenerator.generateLayout();
            HousieDomainRules.validateTicketLayout(generated);
            System.assertEquals(15, countTicketNumbers(generated));
        }
    }

    @IsTest static void malformedTicketLayoutIsRejected() {
        Boolean rejected = false;
        try {
            HousieDomainRules.validateTicketLayout(new List<List<Integer>>{
                new List<Integer>{1,2,3}
            });
        } catch (HousieErrors.HousieException e) {
            rejected = true;
        }
        System.assertEquals(true, rejected);
    }

    private static Integer countTicketNumbers(List<List<Integer>> layout) {
        Integer count = 0;
        for (List<Integer> row : layout) {
            for (Integer value : row) if (value != null) count++;
        }
        return count;
    }
}