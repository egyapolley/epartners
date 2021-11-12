const express = require("express");
const router = require("./routes/index");
const routerTest = require("./routes/indexTest");
const mongoose = require("mongoose");
const helmet = require("helmet");
const path = require("path")


require("dotenv").config({path:path.join(__dirname,'custom.env')});

mongoose.connect("mongodb://localhost/epartners", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
}).then(() => {
    console.log("MongoDB connected")
    const app = express();
    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));

    let PORT = process.env.PORT
    let HOST = process.env.HOST;



    app.use(router);
    app.use("/test", routerTest)

    app.listen(PORT, () => {
        console.log(`Server running  on url : http://${HOST}:${PORT}`)
    })

}).catch(err => {
    console.log("Cannot connect to MongoDB");
    throw err;
});
