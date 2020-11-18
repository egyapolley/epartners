const express = require("express");
const router = express.Router();
const User = require("../model/user");
const validator = require("../utils/validators");
const passport = require("passport");
const BasicStrategy = require("passport-http").BasicStrategy;
const utils = require("../utils/main_utils");
const appData = require("../utils/appData");

const moment = require("moment");


const soapRequest = require("easy-soap-request");
const parser = require('fast-xml-parser');
const he = require('he');
const options = {
    attributeNamePrefix: "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: true,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false,
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),
    tagValueProcessor: (val, tagName) => he.decode(val),
    stopNodes: ["parse-me-as-string"]
};

passport.use(new BasicStrategy(
    function (username, password, done) {
        User.findOne({username: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            user.comparePassword(password, function (error, isMatch) {
                if (err) return done(error);
                else if (isMatch) {
                    return done(null, user)
                } else {
                    return done(null, false);
                }

            })

        });
    }
));


router.get("/bundles", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validatePackageQuery(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })

    }

    const url = "http://172.25.39.16:2222";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
        'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pac="http://SCLINSMSVM01P/wsdls/Surfline/PackageQuery.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <pac:PackageQueryRequest>
         <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
         <CHANNEL>Bundles</CHANNEL>
      </pac:PackageQueryRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.PackageQueryResult) {


            let packages = result.PackageQueryResult;

            const categoriesSet = new Set();
            const bundleEl_Value_Array = [];
            let resultEl_value;
            let acctType = null;

            for (const [k, v] of Object.entries(packages)) {

                if (k.startsWith("bundle")) {
                    let regex = /(.+?)\|/
                    let match = regex.exec(v.toString());
                    categoriesSet.add(match[1]);
                    bundleEl_Value_Array.push(v.toString())

                }
                if (k.startsWith("Result")) {
                    resultEl_value = v.toString();

                }
                if (k.startsWith("AccountType")) {
                    acctType = v.toString();

                }


            }

            if (categoriesSet.size > 0 && bundleEl_Value_Array.length > 0) {
                const final_bundles = [];
                let catArray = [...categoriesSet];
                for (let i = 0; i < catArray.length; i++) {
                    let catValue = catArray[i];
                    let catObject = {};
                    catObject.name = catValue;
                    catObject.bundles = [];
                    for (let j = 0; j < bundleEl_Value_Array.length; j++) {
                        if (bundleEl_Value_Array[j].startsWith(catValue)) {
                            let tempStringArray = bundleEl_Value_Array[j].split("|");
                            let bundleDetails = tempStringArray[1];
                            let price = tempStringArray[2];
                            let bundleId = tempStringArray[3];


                            catObject.bundles.push(
                                {
                                    bundle_name: bundleDetails,
                                    price: price,
                                    bundleId: bundleId,

                                });
                        }

                    }
                    final_bundles.push({
                        packages: catObject
                    })

                }

                res.json({
                    subscriberNumber: subscriberNumber,
                    subscriberAcctType: acctType,
                    status: 0,
                    reason: "success",
                    internetBundles: final_bundles,


                });


            } else {
                res.json({
                    subscriberNumber: subscriberNumber,
                    subscriberAcctType: acctType,
                    status: 1,
                    reason: resultEl_value,
                    internetBundles: null,


                });


            }
        }


    } catch (e) {
        console.log(e)
        res.json({
            status: 1,
            reason: "System failure",
        });

    }


});


router.post("/bundles", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    const {error} = validator.validatePackagePurchase(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel, accountId, transactionId, bundleId} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    if (accountId !== req.user.accountNumber) {
        return res.json({
            status: 2,
            reason: `Invalid Request accountId ${accountId}`
        })

    }

    const url = "http://172.25.39.16:2222";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
        'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:epar="http://SCLINSMSVM01P/wsdls/Surfline/EpartnerDataPurchase.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <epar:EpartnerDataPurchaseRequest>
         <CC_Calling_Party_Id>${accountId}</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
         <Recipient_Number>233255000102</Recipient_Number>
         <RECEPIENT_WALLET_TYPE>Primary</RECEPIENT_WALLET_TYPE>
         <AMOUNT>${bundleId}</AMOUNT>
         <Request_type>Data</Request_type>
      </epar:EpartnerDataPurchaseRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.EpartnerDataPurchaseResult && result.EpartnerDataPurchaseResult.ServiceRequestID) {
            let serviceRequestID = result.EpartnerDataPurchaseResult.ServiceRequestID;
            res.json({
                status: 0,
                reason: "success",
                serviceRequestId: serviceRequestID,
                clientTransactionId: transactionId,
            })


        }


    } catch (err) {
        let errorBody = err.toString();
        if (parser.validate(errorBody) === true) {
            let jsonObj = parser.parse(errorBody, options);
            if (jsonObj.Envelope.Body.Fault) {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(faultString);
                let errorcode = soapFault.detail.EpartnerDataPurchaseFault.errorCode;
                console.log(errorcode)
                switch (errorcode) {
                    case 62:
                        faultString = "Invalid Request Parameter values";
                        break;
                    case 61:
                        faultString = "subscriberNumber not valid";
                        break;

                    default:
                        faultString = "System Error";

                }
                return res.json(
                    {
                        status: 1,
                        reason: faultString,
                        serviceRequestId: null,
                        clientTransactionId: transactionId
                    })

            }


        }

        console.log(errorBody)
        res.json({error: "System Failure"})

    }


});


router.post("/user", async (req, res) => {
    try {
        let {username, password, channel, accountNumber} = req.body;
        let user = new User({
            username,
            password,
            channel,
            accountNumber
        });
        user = await user.save();
        res.json(user);

    } catch (error) {
        res.json({error: error.toString()})
    }


});


router.get("/transactions", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    let {accountId, begin_date, end_date, channel,maxRecords} = req.body;
    const {error} = validator.validateTransactionsQuery({accountId,channel,maxRecords});
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    if (accountId !== req.user.accountNumber) {
        return res.json({
            status: 2,
            reason: `Invalid Request accountId ${accountId}`
        })

    }

    begin_date = moment(begin_date, 'DD-MM-YYYY HH:mm:ss').format("YYYYMMDDHHmmss");
    end_date = moment(end_date, 'DD-MM-YYYY HH:mm:ss').format("YYYYMMDDHHmmss");

    if (moment(end_date,'YYYYMMDDHHmmss').isSameOrBefore(moment(begin_date,'YYYYMMDDHHmmss'))){
        return res.json({
            status: 2,
            reason: `Invalid Request end_date value, must be greater than begin_date`
        })

    }


    const url = "http://172.25.39.13:3003";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'urn:CCSCD7_QRY',
    };

    let xmlRequest = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
   <soapenv:Header/>
   <soapenv:Body>
      <pi:CCSCD7_QRY>
         <pi:AUTH/>
         <pi:username>admin</pi:username>
         <pi:password>admin</pi:password>
         <pi:MSISDN>${accountId}</pi:MSISDN>
         <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
         <pi:EDR_TYPE>5</pi:EDR_TYPE>
         <pi:MAX_RECORDS>${maxRecords}</pi:MAX_RECORDS>
         <pi:DAYS/>
         <pi:START_DATE>${begin_date}</pi:START_DATE>
         <pi:END_DATE>${end_date}</pi:END_DATE>
      </pi:CCSCD7_QRY>
   </soapenv:Body>
</soapenv:Envelope>
`;

    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        if (parser.validate(body) === true) { //optional (it'll return an object in case it's not valid)
            let jsonObj = parser.parse(body, options);
            if (jsonObj.Envelope.Body.CCSCD7_QRYResponse) {
                let finalResult = [];
                let regex = /BALANCE_TYPES=(.+?)\|.*BALANCES=(.+?)\|*.COSTS=(.+?)\|/;
                if (jsonObj.Envelope.Body.CCSCD7_QRYResponse.EDRS) {
                    let result = jsonObj['Envelope']['Body']['CCSCD7_QRYResponse']['EDRS']['EDR_ITEM'];


                    if (Array.isArray(result)) {
                        result.forEach(function (edr) {
                            let edrType = utils.getEdrType(edr.EDR_TYPE);
                            let record_date = utils.formateDate(edr.RECORD_DATE);

                            let matches = edr.EXTRA_INFORMATION.matchAll(regex);
                            for (const el of matches) {
                                let balance_before = el[2];
                                let balance_types = el[1];
                                let cost = el[3];


                                if (balance_types.includes(",")) {
                                    let balance_type_items = balance_types.split(",");
                                    let cost_items = cost.split(",");
                                    let balance_before_items = balance_before.split(",");

                                    for (let i = 0; i < balance_before_items.length; i++) {
                                        let edr_info = {};

                                        if (i === 0) {
                                            edr_info.record_date = record_date;
                                            edr_info.edrType = edrType;

                                        } else {
                                            edr_info.record_date = "";
                                            edr_info.edrType = "";

                                        }

                                        edr_info.balance_type = appData.balanceTypes[balance_type_items[i]];
                                        if (balance_type_items[i] === '21') {
                                            edr_info.cost = (parseFloat(cost_items[i]) / 100).toFixed(2);
                                            edr_info.balance_before = (parseFloat(balance_before_items[i]) / 100).toFixed(2);
                                            edr_info.balance_after = ((parseFloat(balance_before_items[i]) - parseFloat(cost_items[i])) / 100).toFixed(2);

                                        } else {
                                            edr_info.balance_before = balance_before_items[i];
                                            edr_info.cost = cost_items[i];
                                            edr_info.balance_after = (parseInt(balance_before_items[i]) - parseInt(cost_items[i]));

                                        }

                                        finalResult.push(edr_info);


                                    }

                                } else {
                                    let edr_info = {};
                                    edr_info.edrType = edrType;
                                    edr_info.record_date = record_date;
                                    edr_info.balance_type = appData.balanceTypes[balance_types];
                                    if (balance_types === '21') {
                                        edr_info.cost = (parseFloat(cost) / 100).toFixed(2);
                                        edr_info.balance_before = (parseFloat(balance_before) / 100).toFixed(2);
                                        edr_info.balance_after = ((parseFloat(balance_before) - parseFloat(cost)) / 100).toFixed(2);

                                    } else {
                                        edr_info.balance_before = balance_before;
                                        edr_info.cost = cost;
                                        edr_info.balance_after = (parseInt(balance_before) - parseInt(cost));

                                    }


                                    finalResult.push(edr_info)

                                }


                            }


                        });

                    } else {

                        let edr = result;
                        let edrType = utils.getEdrType(edr.EDR_TYPE);
                        let record_date = utils.formateDate(edr.RECORD_DATE);

                        let matches = edr.EXTRA_INFORMATION.matchAll(regex);
                        for (const el of matches) {
                            let balance_before = el[2];
                            let balance_types = el[1];
                            let cost = el[3];

                            if (balance_types.includes(",")) {
                                let balance_type_items = balance_types.split(",");
                                let cost_items = cost.split(",");
                                let balance_before_items = balance_before.split(",");

                                for (let i = 0; i < balance_before_items.length; i++) {
                                    let edr_info = {};

                                    if (i === 0) {
                                        edr_info.record_date = record_date;
                                        edr_info.edrType = edrType;

                                    } else {
                                        edr_info.record_date = "";
                                        edr_info.edrType = "";

                                    }
                                    edr_info.balance_type = appData.balanceTypes[balance_type_items[i]];
                                    if (balance_type_items[i] === '21') {
                                        edr_info.cost = (parseFloat(cost_items[i]) / 100).toFixed(2);
                                        edr_info.balance_before = (parseFloat(balance_before_items[i]) / 100).toFixed(2);
                                        edr_info.balance_after = ((parseFloat(balance_before_items[i]) - parseFloat(cost_items[i])) / 100).toFixed(2);

                                    } else {
                                        edr_info.balance_before = balance_before_items[i];
                                        edr_info.cost = cost_items[i];
                                        edr_info.balance_after = (parseInt(balance_before_items[i]) - parseInt(cost_items[i]));

                                    }


                                    finalResult.push(edr_info);


                                }

                            } else {
                                let edr_info = {};
                                edr_info.edrType = edrType;
                                edr_info.record_date = record_date;
                                edr_info.balance_type = appData.balanceTypes[balance_types];
                                if (balance_types === '21') {
                                    edr_info.cost = (parseFloat(cost) / 100).toFixed(2);
                                    edr_info.balance_before = (parseFloat(balance_before) / 100).toFixed(2);
                                    edr_info.balance_after = ((parseFloat(balance_before) - parseFloat(cost)) / 100).toFixed(2);

                                } else {
                                    edr_info.balance_before = balance_before;
                                    edr_info.cost = cost;
                                    edr_info.balance_after = (parseInt(balance_before) - parseInt(cost));

                                }

                                finalResult.push(edr_info)

                            }
                        }
                    }

                    return res.json(
                        {
                            status: 0,
                            reason: "success",
                            data: finalResult
                        })


                } else {
                    return res.json(
                        {
                            status: 0,
                            reason: "success",
                            data: finalResult
                        })
                }


            } else {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(soapFault);
                return res.json(
                    {
                        status: 1,
                        reason: faultString,
                    })


            }

        }


    } catch (error) {
        console.log(error)
        res.json(
            {
                status: 1,
                reason: "System Failure",
            })


    }


});

router.get("/balance", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    let {accountId,channel} = req.body;
    const {error} = validator.validateBalanceQuery({accountId,channel});
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    if (accountId !== req.user.accountNumber) {
        return res.json({
            status: 2,
            reason: `Invalid Request accountId ${accountId}`
        })

    }



    const url = "http://172.25.39.13:3003";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'urn:CCSCD1_QRY',
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
   <soapenv:Header/>
   <soapenv:Body>
      <pi:CCSCD1_QRY>
         <pi:username>admin</pi:username>
         <pi:password>admin</pi:password>
         <pi:MSISDN>${accountId}</pi:MSISDN>
         <pi:LIST_TYPE>BALANCE</pi:LIST_TYPE>
         <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
         <pi:BALANCE_TYPE>General Cash</pi:BALANCE_TYPE>
      </pi:CCSCD1_QRY>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;
        let balance =null;

        if (parser.validate(body) === true) { //optional (it'll return an object in case it's not valid)
            let jsonObj = parser.parse(body, options);
            if (jsonObj.Envelope.Body.CCSCD1_QRYResponse && jsonObj.Envelope.Body.CCSCD1_QRYResponse.BALANCE ) {
                balance = jsonObj.Envelope.Body.CCSCD1_QRYResponse.BALANCE.toString();
                if (balance){
                    balance = parseFloat((parseFloat(balance)/100).toFixed(2));
                    return res.json(
                        {
                            status: 0,
                            reason: "success",
                            balance:balance.toLocaleString()
                        })
                }






            } else {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(soapFault);
                return res.json(
                    {
                        status: 1,
                        reason: faultString,
                    })


            }

        }







    } catch (error) {
        console.log(error)
        res.json(
            {
                status: 1,
                reason: "System Failure",
            })


    }


});

module.exports = router;

