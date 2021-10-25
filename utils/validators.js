const Joi = require("joi");

module.exports = {

    validatePackageQuery: (body) => {

        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .required(),

        });

        return schema.validate(body)


    },

    validatePackagePurchase: (body) => {

        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .required(),

            transactionId: Joi.string()
                .min(3)
                .max(300)
                .required(),

            bundleId: Joi.string()
                .min(1)
                .max(10)
                .required(),

            accountId: Joi.string()
                .alphanum()
                .required(),
        });

        return schema.validate(body)


    },

    validateTransactionsQuery: (body) => {

        const schema = Joi.object({
            channel: Joi.string()
                .required(),

            accountId: Joi.string()
                .alphanum()
                .required(),

            maxRecords: Joi.number()
                .min(1)
                .max(1000)
                .required(),
        });

        return schema.validate(body)


    },

    validateBalanceQuery:(body) => {

        const schema = Joi.object({
            channel: Joi.string()
                .required(),

            accountId: Joi.string()
                .alphanum()
                .required(),
        });

        return schema.validate(body)


    },
}

