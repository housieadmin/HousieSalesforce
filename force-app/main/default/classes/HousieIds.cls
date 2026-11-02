public with sharing class HousieIds {
    public static String newId() {
        return EncodingUtil.convertToHex(Crypto.generateAesKey(128)).toLowerCase();
    }
    public static String deterministicId(String operationId, Integer ordinal) {
        Blob digest = Crypto.generateDigest('SHA-256', Blob.valueOf(operationId + ':' + String.valueOf(ordinal)));
        return EncodingUtil.convertToHex(digest).substring(0, 32).toLowerCase();
    }
}
