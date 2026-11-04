public class UpdateAccountData {

    // This method takes an account and update the Account Description
    public static void updateAccountDescription(Account account) {
        // Updates Account Description to  a value based on the Annual Revenue
        if(account != null && account.AnnualRevenue >= 5000000) {
            account.Description = 'High Value Account as annual revenue is more than the High value threshold limit';
        } else if(account != null && account.AnnualRevenue < 5000000){
             account.Description = 'Low Value Account as annual revenue is less than the High value threshold limit';
        }
        update account;
    }
}