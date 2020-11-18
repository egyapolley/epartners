const moment = require("moment");

module.exports = {

    formateDate: (date) => {
        return moment(date, "YYYYMMDDHHmmss").format("DD-MM-YYYY HH:mm:ss")
    },

    getEdrType: (edrType) => {

        switch (edrType) {

            case 4:
                return "Recharge";
            case 47:
                return "Voucher Type Recharge";
            case 49:
                return "Recurrent Bundle Recharge";
            case 8:
                return "Custom Recharge"
            case 1:
                return "Data Charging";
            case 2:
                return "Operator Update";
            case 3:
                return "Expiration";
            case 5:
                return "Event Charge";
            case 15:
                return "Voucher Redeem";
            case 16:
                return "Rewards";
            case 31:
                return "Product Type Swap";
            case 52:
                return "Recurrent Bundle State Change";
            case 55:
                return "Wallet Life Cycle ";

        }

    },




}
