public with sharing class HousieTicketGenerator {
    public static List<List<Integer>> generateLayout() {
        for (Integer attempt = 0; attempt < 100; attempt++) {
            List<List<Integer>> candidate = generateCandidate();
            try {
                HousieDomainRules.validateTicketLayout(candidate);
                return candidate;
            } catch (HousieErrors.HousieException invalidCandidate) {
                // Retry the entire occupancy pattern; a valid row/strip count can
                // still create three consecutive blanks across a strip boundary.
            }
        }
        throw new HousieErrors.HousieException('Unable to generate a valid ticket layout. Please retry.');
    }

    private static List<List<Integer>> generateCandidate() {
        List<List<Boolean>> occupied = new List<List<Boolean>>();
        List<List<Integer>> layout = new List<List<Integer>>();
        for (Integer row = 0; row < 3; row++) {
            occupied.add(new List<Boolean>{false,false,false,false,false,false,false,false,false});
            layout.add(new List<Integer>{null,null,null,null,null,null,null,null,null});
        }

        // Each three-column strip has five numbers: one row gets one number,
        // the other two rows get two each. Rotating the single row gives five
        // numbers in every row and every strip.
        for (Integer strip = 0; strip < 3; strip++) {
            Integer singleRow = strip;
            Integer singleColumn = randomIndex(3);
            Integer firstDoubleRow = Math.mod(strip + 1, 3);
            Integer secondDoubleRow = Math.mod(strip + 2, 3);
            Boolean validCoverage = false;

            for (Integer attempt = 0; attempt < 100 && !validCoverage; attempt++) {
                List<Integer> firstPair = randomPair();
                List<Integer> secondPair = randomPair();
                List<Boolean> covered = new List<Boolean>{false,false,false};
                covered[singleColumn] = true;
                for (Integer value : firstPair) covered[value] = true;
                for (Integer value : secondPair) covered[value] = true;
                validCoverage = covered[0] && covered[1] && covered[2];
                if (validCoverage) {
                    occupied[singleRow][strip * 3 + singleColumn] = true;
                    for (Integer value : firstPair) occupied[firstDoubleRow][strip * 3 + value] = true;
                    for (Integer value : secondPair) occupied[secondDoubleRow][strip * 3 + value] = true;
                }
            }
            HousieErrors.require(validCoverage, 'Unable to generate a valid ticket pattern. Please retry.');
        }

        for (Integer column = 0; column < 9; column++) {
            Integer minimum = column == 0 ? 1 : column * 10;
            Integer maximum = column == 0 ? 9 : (column == 8 ? 90 : column * 10 + 9);
            List<Integer> pool = new List<Integer>();
            for (Integer ballNumber = minimum; ballNumber <= maximum; ballNumber++) pool.add(ballNumber);
            shuffle(pool);

            List<Integer> selected = new List<Integer>();
            for (Integer row = 0; row < 3; row++) {
                if (occupied[row][column]) selected.add(pool[selected.size()]);
            }
            selected.sort();
            Integer selectedIndex = 0;
            for (Integer row = 0; row < 3; row++) {
                if (occupied[row][column]) {
                    layout[row][column] = selected[selectedIndex];
                    selectedIndex++;
                }
            }
        }
        return layout;
    }

    private static List<Integer> randomPair() {
        List<Integer> values = new List<Integer>{0,1,2};
        shuffle(values);
        return new List<Integer>{values[0], values[1]};
    }

    private static void shuffle(List<Integer> values) {
        for (Integer i = values.size() - 1; i > 0; i--) {
            Integer j = randomIndex(i + 1);
            Integer current = values[i];
            values[i] = values[j];
            values[j] = current;
        }
    }

    private static Integer randomIndex(Integer upperBound) {
        Integer value = Math.mod(Crypto.getRandomInteger(), upperBound);
        return value < 0 ? value + upperBound : value;
    }

    public static String layoutText(List<List<Integer>> layout) {
        List<String> lines = new List<String>();
        for (List<Integer> row : layout) {
            List<String> cells = new List<String>();
            for (Integer value : row) {
                cells.add(value == null ? '·' : String.valueOf(value).leftPad(2, '0'));
            }
            lines.add(String.join(cells, '  '));
        }
        return String.join(lines, '\n');
    }
}