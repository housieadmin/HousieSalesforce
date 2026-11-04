public class HousieDomainRules {
    public static Decimal availablePoints(Housie_Account__c a) {
        return (a.Points_Balance__c == null ? 0 : a.Points_Balance__c) -
               (a.Reserved_Points__c == null ? 0 : a.Reserved_Points__c);
    }
    public static void assertWalletInvariant(Housie_Account__c a) {
        HousieErrors.require(availablePoints(a) >= 0, 'Available points cannot be negative.');
        HousieErrors.require(a.Reserved_Points__c >= 0, 'Reserved points cannot be negative.');
    }
    public static void validateTicketLayout(List<List<Integer>> rows) {
        HousieErrors.require(rows != null && rows.size() == 3, 'Ticket must contain 3 rows.');
        Set<Integer> allNumbers = new Set<Integer>();
        for (Integer r=0; r<3; r++) {
            HousieErrors.require(rows[r] != null && rows[r].size() == 9, 'Each row must contain 9 cells.');
            Integer count = 0;
            for (Integer c=0; c<9; c++) {
                Integer n = rows[r][c];
                if (n != null) {
                    count++;
                    HousieErrors.require(n >= 1 && n <= 90, 'Ticket number out of range.');
                    HousieErrors.require(!allNumbers.contains(n), 'Duplicate ticket number.');
                    allNumbers.add(n);
                    Integer minN = c == 0 ? 1 : c*10;
                    Integer maxN = c == 0 ? 9 : (c == 8 ? 90 : c*10+9);
                    HousieErrors.require(n >= minN && n <= maxN, 'Number is in the wrong column.');
                }
            }
            HousieErrors.require(count == 5, 'Each ticket row must contain exactly 5 numbers.');
        }
        HousieErrors.require(allNumbers.size() == 15, 'Ticket must contain exactly 15 numbers.');
        for (Integer block=0; block<3; block++) {
            Integer blockCount = 0;
            for (Integer r=0; r<3; r++) for (Integer c=block*3; c<block*3+3; c++)
                if (rows[r][c] != null) blockCount++;
            HousieErrors.require(blockCount == 5, 'Each horizontal 3x3 block must contain exactly 5 numbers.');
        }
        for (Integer r=0; r<3; r++) for (Integer c=0; c<7; c++)
            HousieErrors.require(!(rows[r][c] == null && rows[r][c+1] == null && rows[r][c+2] == null),
                'Three consecutive blank cells are not permitted.');
        for (Integer c=0; c<9; c++) for (Integer r=0; r<1; r++)
            HousieErrors.require(!(rows[r][c] == null && rows[r+1][c] == null && rows[r+2][c] == null),
                'Three consecutive blank cells are not permitted vertically.');
        for (Integer c=0; c<9; c++) {
            Integer previous = 0;
            for (Integer r=0; r<3; r++) if (rows[r][c] != null) {
                HousieErrors.require(rows[r][c] > previous, 'Numbers must ascend within each column.');
                previous = rows[r][c];
            }
        }
    }
    public static Decimal[] equalShares(Decimal total, Integer contributors) {
        HousieErrors.require(total != null && total >= 0 && contributors > 0, 'Invalid share calculation.');
        Decimal each = (total / contributors).setScale(2, RoundingMode.DOWN);
        Decimal[] shares = new Decimal[]{};
        Decimal allocated = 0;
        for (Integer i=0; i<contributors; i++) { shares.add(each); allocated += each; }
        Integer cents = ((total-allocated)*100).setScale(0).intValue();
        for (Integer i=0; i<cents; i++) shares[i] += 0.01;
        return shares;
    }
}