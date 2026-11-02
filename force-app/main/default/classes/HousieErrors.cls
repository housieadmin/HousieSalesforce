public class HousieErrors {
    public class HousieException extends Exception {}
    public static void require(Boolean condition, String message) {
        if (!condition) throw new HousieException(message);
    }
}
