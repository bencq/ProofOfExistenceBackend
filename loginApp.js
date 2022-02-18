
const os = require('os');
const child_process = require('child_process');

const express = require('express');
const axios = require('axios').default;
const jwt = require('jsonwebtoken');
const passport = require('passport');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');




const User = require('./model/User');
const Evidence = require('./model/Evidence');
const EvidenceIDDoc = require('./model/EvidenceIDDoc');

const utils = require('./config/utils');
const config = require('./config/config');
const mongodb = require('./config/mongodb');



const multerMw = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            console.log('destination--------------------------');
            console.log(req.locals.user);
            console.log(req.body);
            console.log(file);
            console.log('destination--------------------------');
            let timestamp = new Date();
            let ts_yyyymmdd = timestamp.yyyymmdd();
            
            let destinationPath = path.resolve(__dirname, 'uploads', req.locals.user.username, ts_yyyymmdd);
            if(!fs.existsSync(destinationPath))
            {
                fs.mkdirSync(destinationPath, {recursive: true});
            }
            cb(null, destinationPath);
        },
        // filename: (req, file, cb) => {
        //     console.log("filename----------------");
        //     console.log(req.locals.user);
        //     console.log(req.body);
        //     console.log(file);
        //     console.log("filename----------------");
        //     cb(null, file.originalname);
        // },
    }),
    fileFilter: (req, file, cb) => {

        const maxFileSize = 1024 * 1024 * 1024;
        console.log('filter------------------------');
        
        console.log(req.locals.user);
        console.log(req.body);
        console.log(file);

        console.log('filter------------------------');

        let apiName = req.body.apiName;
        let evidenceType = req.body.evidenceType;
        if(apiName !== 'postEvidence' || evidenceType !== 'file') {
            cb(null, false);
        }
        else if(file.size > maxFileSize)
        {
            cb(null, false);
        }
        else {
            cb(null, true);
        }
        
        
        
    }
});


var app = express();

//cors
app.use(function (req, resp, next) {
    resp.header('Access-Control-Allow-Origin', '*');
    resp.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    return next();
});




//passport initialize
require('./config/passport')(passport);
app.use(passport.initialize());

//parse post body
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, resp, next)=>{
    req.locals = {};
    next();
});



`
req.query.param: url_encoded
req.body.param: form-data or post body
`



//mongodb connect
mongoose.connect(mongodb.mongodbURI)
    .then((res) => {
        console.log('mongoose connected!');
    })
    .catch((error) => {
        console.log(error);
    });

//get next evidenceID
var getEvidenceID = (async () => {
    let newEvidenceID = NaN;
    await EvidenceIDDoc.findOne({}).then(async (evidenceIDDoc)=>{
        if(!evidenceIDDoc)
        {
            let newEvidenceIDDoc = new EvidenceIDDoc({
                evidenceID: 1
            });
            await newEvidenceIDDoc.save().then((evidenceIDDoc)=>{
                newEvidenceID = evidenceIDDoc.evidenceID;
            })
        }
        else
        {
            console.log(evidenceIDDoc);
            newEvidenceID = evidenceIDDoc.evidenceID + 1;
            console.log(newEvidenceID)
            await EvidenceIDDoc.findOneAndUpdate({}, {$inc:{evidenceID: 1}});
        }
    });
    return newEvidenceID;
});

//evidence api
var v1ApiName2func = {
    "postEvidence": async (req, resp, next) => {
        let apiName = req.body.apiName;
        let { username } = req.locals.user;
        let { keyStorePassword, keyPassword, info } = req.locals;
        let { evidenceData, evidenceName, evidenceType } = req.body;

        let evidenceID = await getEvidenceID();

        let object_output = {};

        let params_cmd = [apiName, 'depositor', keyStorePassword, keyPassword, evidenceID, info, evidenceData];
        let params_local = [evidenceType];
        let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
        

        if (!paramsComplete) {
            object_output = {
                status: -1,
                message: "params not complete"
            }
            resp.status(400);
        }
        else {
            params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
            let cmd = [config.evidenceExe, ...params_cmd].join(" ");
            object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
            object_output = JSON.parse(object_output);
            if(object_output.status == 0)
            {
                let { newEvidenceAddress: evidenceAddress, blockNumber, transactionHash, timestamp, evidenceHash } = object_output.data;
                let evidence = new Evidence({
                    evidenceAddress: evidenceAddress, //key
                    //////////////////////////
                    username: username,
                    evidenceData: evidenceData,
                    transactionHash: transactionHash,
                    //// items for convenience of search
                    evidenceName: evidenceName,
                    evidenceType: evidenceType,
                    //redundant items
                    blockNumber: blockNumber,
                    timestamp: timestamp,
                    /////////////
                    evidenceID: evidenceID,
                    evidenceHash: evidenceHash
                });
                evidence.save().then((evidence) => {
                    console.log(evidence);
                })
                object_output.data.evidenceID = evidenceID;
            }
        }
        resp.send(object_output);
    },
    "verifyEvidence": (req, resp, next) => {
        let { username } = req.locals.user;
        let { keyStorePassword, keyPassword, info } = req.locals;
        let { apiName, evidenceAddress } = req.body;

        let object_output = {};

        let params_cmd = [apiName, username, keyStorePassword, keyPassword, evidenceAddress];
        let params_local = [];
        let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
        

        if (!paramsComplete) {
            object_output = {
                status: -1,
                message: "params not complete"
            }
            resp.status(400);
        }
        else {
            params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
            let cmd = [config.evidenceExe, ...params_cmd].join(" ");
            object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
        }

        resp.send(object_output);
    },
    "getEvidence": async (req, resp, next) => {
        let { username } = req.locals.user;
        let { keyStorePassword, keyPassword, info } = req.locals;
        let { apiName, contentData, contentType } = req.body;


        let object_output = {};

        let params_cmd = [apiName, username, keyStorePassword, keyPassword];
        let params_local = [contentData, contentType];
        let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
        

        if (!paramsComplete) {
            object_output = {
                status: -1,
                message: "params not complete"
            }
            resp.status(400);
        }
        else {
            if(contentType === "evidenceAddress")
            {
                let evidenceAddress = contentData;
                params_cmd.push(evidenceAddress);

                params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
                let cmd = [config.evidenceExe, ...params_cmd].join(" ");

                object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
                object_output = JSON.parse(object_output);
                if(object_output.status == 0)
                {
                    let evidenceAddress = contentData;
                    await Evidence.findOne({ evidenceAddress: {$regex: "^(0x)?" + evidenceAddress + "$"} }).then((evidence) => {
                        if (!evidence) {
                            console.log(evidence);
                        } else {
                            console.log(evidence);
        
                            object_output.data.username = evidence.username;
                            object_output.data.evidenceType = evidence.evidenceType;
                            object_output.data.evidenceData = evidence.evidenceData;
                            object_output.data.evidenceAddress = evidence.evidenceAddress;
                            object_output.data.transactionHash = evidence.transactionHash;
                            object_output.data.blockNumber = evidence.blockNumber;
                            object_output.data.timestamp = evidence.timestamp;
                            object_output.data.evidenceName = evidence.evidenceName;
        
                            //existed in original output
                            // object_output.data.evidenceID = evidence.evidenceID;
                            // object_output.data.evidenceHash = evidence.evidenceHash;
                            // object_output.data.info = evidence.info;
    
        
                        }
                    });
                }
            }
            else if(contentType === "evidenceID")
            {

                try {
                    let evidenceID = parseInt(contentData);
                    await Evidence.findOne({ evidenceID: evidenceID }).then((evidence) => {
                        if (!evidence) {
                            console.log(evidence);
    
                            object_output = {
                                status: -1,
                                message: "evidence with evidenceID: " + contentData + " not found in db!"
                            }
    
                        } else {
                            console.log(evidence);
        
                            params_cmd.push(evidence.evidenceAddress);
    
                            params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
                            let cmd = [config.evidenceExe, ...params_cmd].join(" ");
                            object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
                            object_output = JSON.parse(object_output);
    
                            if(object_output.status == 0)
                            {
                                object_output.data.username = evidence.username;
                                object_output.data.evidenceType = evidence.evidenceType;
                                object_output.data.evidenceData = evidence.evidenceData;
                                object_output.data.evidenceAddress = evidence.evidenceAddress;
                                object_output.data.transactionHash = evidence.transactionHash;
                                object_output.data.blockNumber = evidence.blockNumber;
                                object_output.data.timestamp = evidence.timestamp;
                                object_output.data.evidenceName = evidence.evidenceName;
            
                                //existed in original output
                                // object_output.data.evidenceID = evidence.evidenceID;
                                // object_output.data.evidenceHash = evidence.evidenceHash;
                                // object_output.data.info = evidence.info;
                            }
                        }
                    });
                } catch (error) {
                    console.log(error);
                    object_output = {
                        status: -1,
                        message: "\"" + contentData + "\" is not a valid evidenceID"
                    }
                    resp.status(400);
                }
            }
            else if(contentType === "evidenceName")
            {


                try {
                    let evidenceName = contentData;
                    await Evidence.findOne({ evidenceName: evidenceName }).then((evidence) => {
                        if (!evidence) {
                            console.log(evidence);
    
                            object_output = {
                                status: -1,
                                message: "evidence with evidenceName: " + contentData + " not found in db!"
                            }
    
                        } else {
                            console.log(evidence);
        
                            params_cmd.push(evidence.evidenceAddress);
    
                            params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
                            let cmd = [config.evidenceExe, ...params_cmd].join(" ");
                            object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
                            object_output = JSON.parse(object_output);
    
                            if(object_output.status == 0)
                            {
                                object_output.data.username = evidence.username;
                                object_output.data.evidenceType = evidence.evidenceType;
                                object_output.data.evidenceData = evidence.evidenceData;
                                object_output.data.evidenceAddress = evidence.evidenceAddress;
                                object_output.data.transactionHash = evidence.transactionHash;
                                object_output.data.blockNumber = evidence.blockNumber;
                                object_output.data.timestamp = evidence.timestamp;
                                object_output.data.evidenceName = evidence.evidenceName;
            
                                //existed in original output
                                // object_output.data.evidenceID = evidence.evidenceID;
                                // object_output.data.evidenceHash = evidence.evidenceHash;
                                // object_output.data.info = evidence.info;
                            }
                        }
                    });
                } catch (error) {
                    console.log(error);
                    object_output = {
                        status: -1,
                        message: "\"" + contentData + "\" is not a valid evidenceID"
                    }
                    resp.status(400);
                }
            }
            else
            {
                object_output = {
                    status: -1,
                    message: "unknown contentType: " + contentType + "!"
                }
                resp.status(400);
            }
        }
        resp.send(object_output);
    },

    /////////////////////////////////////////
    "searchEvidence": async (req, resp, next) => {
        console.log(req.body);
        let { username } = req.locals.user;
        let { apiName, sorter, blockNumber, dateRange, evidenceName, evidenceType } = req.body;
        let object_output = {
            status: 0,
            data: {

            }
        };

        let queryObject = {};
        if (username) {
            queryObject.username = username;
        }
        if (blockNumber) {
            queryObject.blockNumber = blockNumber;
        }
        if (evidenceName) {
            queryObject.evidenceName = {$regex: evidenceName};
        }
        if (evidenceType) {
            queryObject.evidenceType = evidenceType;
        }
        if (dateRange && dateRange.length == 2) {
            let stDate = new Date(dateRange[0]);
            stDate.setHours(0);
            stDate.setMinutes(0);
            stDate.setSeconds(0);
            stDate.setMilliseconds(0);

            let edDate = new Date(dateRange[1]);
            edDate.setHours(23);
            edDate.setMinutes(59);
            edDate.setSeconds(59);
            edDate.setMilliseconds(999);
            queryObject.timestamp = {
                $gte: stDate.getTime(),
                $lte: edDate.getTime(),
            }
        }
        console.log("queryObject", queryObject);
        await Evidence.find(queryObject).limit(100).then((evidences) => {
            console.log("evidences", evidences);
            object_output.data.evidences = evidences;
        });
        resp.send(object_output);
    },
    ////////////////////
    "exploreEvidence": async (req, resp, next) => {
        console.log(req.body);
        let { username } = req.locals.user;
        let { keyStorePassword, keyPassword, info } = req.locals;
        let { apiName, evidenceAddress } = req.body;
        
        let object_output = {};

        let params_cmd = ['getEvidence', username, keyStorePassword, keyPassword, evidenceAddress];
        let params_local = [];
        let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });

        if (!paramsComplete) {
            object_output = {
                status: -1,
                message: "params not complete"
            }
            resp.status(400);
        } else {

            params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
            let cmd = [config.evidenceExe, ...params_cmd].join(" ");

            object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
            object_output = JSON.parse(object_output);
            if(object_output.status == 0)
            {
                await Evidence.findOne({ evidenceAddress: {$regex: "^(0x)?" + evidenceAddress + "$"} }).then((evidence) => {
                    if (!evidence) {
                        console.log(evidence);
                    } else {
                        console.log(evidence);
    

                        object_output.data.username = evidence.username;
                        object_output.data.evidenceType = evidence.evidenceType;
                        object_output.data.evidenceData = evidence.evidenceData;
                        object_output.data.evidenceAddress = evidence.evidenceAddress;
                        object_output.data.transactionHash = evidence.transactionHash;
                        object_output.data.blockNumber = evidence.blockNumber;
                        object_output.data.timestamp = evidence.timestamp;
                        object_output.data.evidenceName = evidence.evidenceName;

                        if(evidence.evidenceType === 'file')
                        {
                            object_output.data.file = evidence.file;
                        }

                        //existed in original output
                        // object_output.data.evidenceID = evidence.evidenceID;
                        // object_output.data.evidenceHash = evidence.evidenceHash;
                        // object_output.data.info = evidence.info;

    
                    }
                });
            }
        }
        resp.send(object_output);
    },
    "downloadEvidenceFile": async (req, resp, next) => {
        let { username } = req.locals.user;
        let { keyStorePassword, keyPassword, info } = req.locals;
        let { apiName, evidenceAddress} = req.body;

        let params_cmd = [];
        let params_local = [evidenceAddress];
        let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
        

        if (!paramsComplete) {
            let object_output = {
                status: -1,
                message: "params not complete"
            }

            resp.status(400).send(object_output);
            
        }
        else {

            let file = null;
            let queryObject = {
                evidenceAddress: {$regex: "^(0x)?" + evidenceAddress + "$"},
                username: username
            };
            await Evidence.findOne(queryObject).then((evidence) => {
                if (!evidence) {
                    console.log(evidence);
                } else {
                    console.log(evidence);

                    file = evidence.file;
                    
                }
            });

            if(file)
            {
                let evidenceFilePath = path.resolve(file.destination, file.filename);
                resp.download(evidenceFilePath, file.originalname);
            }
            else
            {
                let object_output = {
                    status: -1,
                    message: "file not found!"
                }
                resp.status(404).send(object_output);
            }
        }
        
    }
};


app.post("/exportedAPI/v:apiVersion",
    (req, resp, next) => {
        passport.authenticate('jwt', { session: false }, (err, user, info) => {
            console.log(req.url);
            console.log(req.params.apiVersion);
            if (!user) {
                let object_output = {
                    status: -1,
                    message: "Unauthorized!",
                }
                resp.status(401).send(object_output);
            } else {
                
                //self determined params
                req.locals.user = user;
                req.locals.keyPassword = "123456";
                req.locals.keyStorePassword = "123456";
                req.locals.info = user.username;

                let { apiName } = req.body;
                console.log(apiName);
                if (apiName in v1ApiName2func) {
                    let func = v1ApiName2func[apiName];
                    func(req, resp, next);
                }
                else {
                    return next();
                }
            }
        })(req, resp, next);
    },
    multerMw.single('upload_file'),
    async (req, resp, next) => {
        console.log('multer-------------------')
        console.log(req.locals.user);
        console.log(req.body);
        console.log(req.file);
        console.log('multer-------------------')

        let object_output = {};

        if(req.file)
        {
            let apiName = req.body.apiName;
            let { username } = req.locals.user;
            let { keyStorePassword, keyPassword, info } = req.locals;
            let { evidenceName, evidenceType } = req.body;
    
            let evidenceID = await getEvidenceID();
    

    
            let params_cmd = [apiName, 'depositor', keyStorePassword, keyPassword, evidenceID, info];
            let params_local = [evidenceType];
            let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
            
    
            if (!paramsComplete) {
                object_output = {
                    status: -1,
                    message: "params not complete"
                }
                resp.status(400);
            }
            else {
                let fileData = fs.readFileSync(req.file.path);
                let evidenceData = crypto.createHash('sha512').update(fileData).digest('hex');
                params_cmd.push(evidenceData);

                params_cmd.forEach((value, index, array) => { array[index] = '\'' + value + '\'' });
                let cmd = [config.evidenceExe, ...params_cmd].join(" ");
                object_output = child_process.execSync(cmd, { env: Object.assign({ "ExportedAPI": true }, process.env) });
                object_output = JSON.parse(object_output);
                let file = (
                    ({
                        originalname,
                        encoding,
                        mimetype,
                        destination,
                        filename,
                        size
                    }) =>
                    ({
                        originalname,
                        encoding,
                        mimetype,
                        destination,
                        filename,
                        size
                    })
                )(req.file);

                if(object_output.status == 0)
                {
                    let { newEvidenceAddress: evidenceAddress, blockNumber, transactionHash, timestamp, evidenceHash } = object_output.data;
                    let evidence = new Evidence({
                        evidenceAddress: evidenceAddress, //key
                        //////////////////////////
                        username: username,
                        evidenceData: evidenceData,
                        transactionHash: transactionHash,
                        //// items for convenience of search
                        evidenceName: evidenceName,
                        evidenceType: evidenceType,
                        file: file,
                        //redundant items
                        blockNumber: blockNumber,
                        timestamp: timestamp,
                        /////////////
                        evidenceID: evidenceID,
                        evidenceHash: evidenceHash
                    });
                    evidence.save().then((evidence) => {
                        console.log(evidence);
                    })
                    object_output.data.evidenceID = evidenceID;
                }
            }
        }
        else
        {
            let apiName = req.body.apiName;
            object_output = {
                status: -1,
                "mesaage": "apiName: \"" + apiName + "\" not found"
            };
            resp.status(400);
        }
        resp.send(object_output);
    }
);


//auth api
app.post('/exportedAPI/login', (req, resp, next) => {
    console.log(req.url);
    let { username, password } = req.body;
    let params_cmd = [];
    let params_local = [username, password];
    let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });
    if (!paramsComplete) {
        let object_output = {
            status: -1,
            message: "fields not complete!"
        }
        
        resp.send(object_output);
    } else {
        User.findOne({ username: username }).then((user) => {
            if (!user) {
                let object_output = {
                    status: -1,
                    message: "user with username \"" + username + "\" not existed!"
                }
                resp.status(400).send(object_output);
            } else {
                let verified = bcrypt.compareSync(password, user.password);
                if (verified) {
                    let jwt_payload = {
                        username: username,
                    }
                    let jwt_token = jwt.sign(jwt_payload, config.secret, {
                        expiresIn: config.expiresIn
                    });
                    // let bearer_token = "Bearer " + jwt_token;
                    let bearer_token = jwt_token;
                    let object_output = {
                        status: 0,
                        data: {
                            // expired: config.expiresIn * 1000,//unit(ms)
                            token: bearer_token
                        }
                    }
                    resp.send(object_output);
                }
                else {
                    let object_output = {
                        status: -1,
                        message: "incorrect password!"
                    }
                    resp.status(400);
                    resp.send(object_output);
                }

            }
        });
    }
});

app.post('/exportedAPI/register', (req, resp, next) => {
    let { username, password, password2 } = req.body;
    let params_cmd = [];
    let params_local = [username, password, password2];
    let paramsComplete = params_cmd.concat(params_local).every((value, index, array) => { return value !== undefined });

    if (!paramsComplete) {
        let object_output = {
            status: -1,
            message: "fields not complete!"
        }
        resp.status(400).send(object_output);
    }
    else if (password !== password2) {
        let object_output = {
            status: -1,
            message: "passwords do not match!"
        }
        resp.status(400).send(object_output);
    }
    else if (password.length < 6) {
        let object_output = {
            status: -1,
            message: "password too simple: less than 6 characters!"
        }
        resp.status(400).send(object_output);
    }
    else {
        User.findOne({ username: username }).then((user) => {
            if (user) {
                let object_output = {
                    status: -1,
                    message: "user with username \"" + username + "\" already existed!"
                }
                resp.status(400).send(object_output);
            } else {
                let newUser = new User({
                    username: username,
                    password: password
                });
                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newUser.password, salt, (err, hashedPassword) => {
                        if (err)
                            throw err;
                        newUser.password = hashedPassword;
                        newUser
                            .save()
                            .then(user => {
                                let object_output = {
                                    status: 0,
                                    data: {
                                        success: 1
                                    }
                                }
                                resp.send(object_output);
                            })
                            .catch((err) => {
                                console.log(err)
                            });
                    });
                });
            }
        });
    }
});


app.get('/exportedAPI/test', async (req, resp, next) => {
    console.log(req.url);

    resp.send({});
});





const LISTENING_PORT = 8000;
app.listen(LISTENING_PORT);
console.log("listening on port: " + LISTENING_PORT);